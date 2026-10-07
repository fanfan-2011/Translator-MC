/**
 * 安装包下载器：流式下载 + Range 断点续传 + 进度回调 + 可取消 + 失败重试 + 磁盘预检。
 *
 * 实测约束（design/UPDATE-v2.1-SPEC.md §0.1）：
 * - 两端资产地址都会 302 到 CDN，**必须用 GET 跟随**（GitCode 的 HEAD 被拦成 401）；
 * - CDN 链接带时效签名 → 续传时重新请求原始地址、重新跟随 302，再把 Range 头交给 CDN；
 * - 服务端忽略 Range（返回 200）时必须丢弃旧分片从头写，否则文件会错位。
 *
 * 兼容性（design/COMPAT-PLAN.md）：
 * - 网络走 Electron 的 net（见 http.ts），自动继承系统代理 / PAC / 企业证书；
 * - 失败自动退避重试（分片保留 → 每次重试天然从断点续传，不重下已完成的字节）；
 * - 开下前检查磁盘空间，避免下到一半才失败。
 */
import { createHash } from 'crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { InstallerKind, UpdateSource } from './types'
import { httpStream, isRetryable, NetError, RETRY_DELAYS } from './http'

export interface DownloadTask {
  source: UpdateSource
  kind: InstallerKind
  version: string
  /** 资产文件名，如 Translator-MC-Setup-win-2.1.0.exe */
  name: string
  /** 下载直链 */
  url: string
  /** 已知总大小（可选；缺省从响应头取） */
  total?: number
  /** 已知 sha256（GitHub API 的 digest 会带 `sha256:` 前缀，调用方剥掉） */
  sha256?: string
}

export interface DownloadProgress {
  received: number
  total: number
  /** 0-100，总大小未知时为 0 */
  percent: number
  /** 字节/秒（指数平滑） */
  speed: number
}

export type DownloadState = 'done' | 'cancelled' | 'error'

export interface DownloadResult {
  state: DownloadState
  /** 成功时的最终文件路径 */
  path?: string
  bytes?: number
  error?: string
}

interface PartMeta {
  url: string
  name: string
  version: string
  kind: InstallerKind
  source: UpdateSource
  received: number
  total: number
  updatedAt: number
}

/** 内部：本轮失败但值得重试 */
interface RetrySignal {
  state: 'retry'
  error?: string
}
type AttemptResult = DownloadResult | RetrySignal

const IDLE_TIMEOUT_MS = 30_000
/** 下载总尝试次数（1 次首发 + 3 次重试，退避 1s/3s/7s） */
const DOWNLOAD_ATTEMPTS = RETRY_DELAYS.length + 1
/** 磁盘预留倍数：分片 + 安装/解压临时空间 */
const DISK_FACTOR = 2.2

function mb(n: number): string {
  return `${Math.round((n / 1024 / 1024) * 10) / 10}MB`
}

/** 目标盘可用字节（拿不到就返回 undefined，不阻塞下载） */
function freeBytes(path: string): number | undefined {
  try {
    const s = statfsSync(path)
    return Number(s.bavail) * Number(s.bsize)
  } catch {
    return undefined
  }
}

function sleepSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true }
    )
  })
}

export class Downloader {
  private ctrl: AbortController | null = null

  /** @param root 下载根目录（`%APPDATA%/game-localizer/updates`） */
  constructor(private readonly root: string) {}

  /** 该版本资产的落盘路径 */
  targetPath(task: Pick<DownloadTask, 'version' | 'name'>): string {
    return join(this.root, task.version, task.name)
  }

  private dirFor(version: string): string {
    return join(this.root, version)
  }

  private partPath(task: Pick<DownloadTask, 'version' | 'name'>): string {
    return this.targetPath(task) + '.part'
  }

  private metaPath(task: Pick<DownloadTask, 'version' | 'name'>): string {
    return this.targetPath(task) + '.part.json'
  }

  /** 读取断点信息（分片存在且元数据一致才认） */
  readResume(task: Pick<DownloadTask, 'version' | 'name' | 'url' | 'total'>): PartMeta | null {
    try {
      const meta = JSON.parse(readFileSync(this.metaPath(task), 'utf8')) as PartMeta
      const part = this.partPath(task)
      if (!existsSync(part)) return null
      if (meta.url !== task.url || meta.name !== task.name) return null
      const size = statSync(part).size
      if (size <= 0) return null
      return { ...meta, received: size }
    } catch {
      return null
    }
  }

  /** 已经下好的成品（大小对得上才算） */
  completedFile(task: Pick<DownloadTask, 'version' | 'name' | 'total'>): string | null {
    const target = this.targetPath(task)
    if (!existsSync(target)) return null
    if (task.total && statSync(target).size !== task.total) return null
    return target
  }

  /** 清空某版本的分片与元数据 */
  clearPart(task: Pick<DownloadTask, 'version' | 'name'>): void {
    try {
      rmSync(this.partPath(task), { force: true })
      rmSync(this.metaPath(task), { force: true })
    } catch {
      /* 清理失败不影响主流程 */
    }
  }

  cancel(): void {
    this.ctrl?.abort()
    this.ctrl = null
  }

  /** 写断点元数据（续传与重试都依赖它） */
  private writeMeta(task: DownloadTask, received: number, total: number): void {
    try {
      const meta: PartMeta = {
        url: task.url,
        name: task.name,
        version: task.version,
        kind: task.kind,
        source: task.source,
        received,
        total,
        updatedAt: Date.now()
      }
      writeFileSync(this.metaPath(task), JSON.stringify(meta), 'utf8')
    } catch {
      /* 断点信息写失败不影响结果 */
    }
  }

  /** 开始或继续下载（失败自动退避重试，分片保留 → 每次从断点继续） */
  async start(task: DownloadTask, onProgress?: (p: DownloadProgress) => void): Promise<DownloadResult> {
    // 同一时刻只允许一个下载在跑：否则两次调用会各自开一个写流写同一个 .part 文件 → 文件损坏。
    // 先中断上一次（它就返回 cancelled），再开始新的。
    this.cancel()
    mkdirSync(this.dirFor(task.version), { recursive: true })

    // 已下好 → 直接返回（幂等）
    const done = this.completedFile(task)
    if (done) return { state: 'done', path: done, bytes: statSync(done).size }

    // 磁盘预检：早失败好过下到一半才失败
    const need = task.total ? Math.ceil(task.total * DISK_FACTOR) : 0
    const free = freeBytes(this.root)
    if (need && free !== undefined && free < need) {
      return {
        state: 'error',
        error: `磁盘空间不足：安装包 ${mb(task.total ?? 0)}，建议至少预留 ${mb(need)}（含安装临时空间），当前可用 ${mb(free)}。请清理磁盘后重试。`
      }
    }

    const ctrl = new AbortController()
    this.ctrl = ctrl
    const signal = ctrl.signal
    let lastError = ''

    try {
      for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
        const r = await this.transfer(task, signal, onProgress)
        if (r.state !== 'retry') return r
        lastError = r.error ?? '下载失败'
        if (attempt < DOWNLOAD_ATTEMPTS) {
          await sleepSignal(RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)], signal)
        }
        if (signal.aborted) return { state: 'cancelled' }
      }
      return { state: 'error', error: `${lastError}（已重试 ${DOWNLOAD_ATTEMPTS - 1} 次）` }
    } finally {
      // 只有「我这一代」仍是当前下载时才清空，否则会把后来者的 ctrl 清掉（用户再点取消就失灵）
      if (this.ctrl === ctrl) this.ctrl = null
    }
  }

  /** 单次传输（可能从断点继续） */
  private async transfer(
    task: DownloadTask,
    signal: AbortSignal,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<AttemptResult> {
    const resume = this.readResume(task)
    const offset = resume?.received ?? 0
    const part = this.partPath(task)

    let out: ReturnType<typeof createWriteStream> | null = null
    let received = offset
    let total = task.total ?? 0
    let speed = 0
    let lastAt = Date.now()
    let lastBytes = offset
    /** onResponse 里发现的致命问题（如 404/403），流结束后据此判定 */
    let httpError = ''
    let retryable = false

    const headers: Record<string, string> = {}
    if (offset > 0) headers['Range'] = `bytes=${offset}-`

    const flush = async (): Promise<void> => {
      if (!out || out.destroyed) return
      await new Promise<void>((resolve) => {
        out!.once('close', () => resolve())
        out!.end()
      })
    }

    try {
      await httpStream(task.url, {
        headers,
        idleTimeoutMs: IDLE_TIMEOUT_MS,
        signal,
        onResponse: (h) => {
          const serverHonouredRange = h.status === 206
          if (h.status < 200 || (h.status >= 300 && h.status !== 206)) {
            httpError =
              h.status === 403
                ? 'HTTP 403（可能被限流）'
                : h.status === 404
                  ? 'HTTP 404（安装包不存在，可能该版本尚未上传附件）'
                  : `HTTP ${h.status}`
            retryable = h.status >= 500 || h.status === 429
            try {
              h.stream.destroy()
            } catch {
              /* 忽略 */
            }
            return
          }
          // 服务端不支持续传（忽略 Range 返回 200）→ 丢掉旧分片从头写，否则文件错位
          const append = offset > 0 && serverHonouredRange
          if (offset > 0 && !serverHonouredRange) {
            received = 0
            lastBytes = 0
          }
          total = parseTotal(h.headers, received) ?? task.total ?? 0
          out = createWriteStream(part, { flags: append ? 'a' : 'w' })
          const stream = out
          onProgress?.({ received, total, percent: total ? Math.round((received / total) * 100) : 0, speed: 0 })

          h.stream.on('data', (chunk: Buffer) => {
            const buf = Buffer.from(chunk)
            if (!stream.write(buf)) {
              h.stream.pause()
              stream.once('drain', () => h.stream.resume())
            }
            received += buf.length
            const now = Date.now()
            if (now - lastAt >= 250) {
              const inst = ((received - lastBytes) * 1000) / (now - lastAt)
              speed = speed === 0 ? inst : speed * 0.7 + inst * 0.3
              lastAt = now
              lastBytes = received
              onProgress?.({ received, total, percent: total ? Math.round((received / total) * 100) : 0, speed })
            }
          })
        }
      })

      await flush()
      if (signal.aborted) return { state: 'cancelled' }
      if (httpError) {
        if (retryable) return { state: 'retry', error: httpError }
        return { state: 'error', error: httpError }
      }

      // 写断点元数据（供下次续传）
      this.writeMeta(task, received, total)

      const finalSize = statSync(part).size
      if (total && finalSize !== total) {
        // 少字节：连接可能提前结束 → 可重试（分片保留，下次从断点继续）
        return { state: 'retry', error: `大小不符：${finalSize}/${total}` }
      }

      // 可选校验（GitHub API 提供 sha256）
      if (task.sha256) {
        const actual = await hashFile(part)
        if (actual.toLowerCase() !== task.sha256.toLowerCase()) {
          // 内容坏了 → 丢掉分片重下一次
          this.clearPart(task)
          return { state: 'retry', error: 'sha256 校验失败（已丢弃分片重下）' }
        }
      }

      rmSync(this.targetPath(task), { force: true })
      renameSync(part, this.targetPath(task))
      rmSync(this.metaPath(task), { force: true })
      onProgress?.({ received: finalSize, total: total || finalSize, percent: 100, speed })
      return { state: 'done', path: this.targetPath(task), bytes: finalSize }
    } catch (e) {
      await flush()
      if (signal.aborted) return { state: 'cancelled' }
      const size = existsSync(part) ? statSync(part).size : 0
      if (size > 0) this.writeMeta(task, size, task.total ?? 0)
      if (e instanceof NetError && e.kind === 'aborted') return { state: 'cancelled' }
      const msg = e instanceof Error ? e.message : String(e)
      if (isRetryable(e)) return { state: 'retry', error: msg }
      return { state: 'error', bytes: size, error: msg }
    }
  }
}

/** 从 Content-Range / Content-Length 解析总大小 */
export function parseTotal(headers: Record<string, string>, offset: number): number | undefined {
  const cr = headers['content-range']
  if (cr) {
    const m = /\/(\d+)\s*$/.exec(cr)
    if (m) return parseInt(m[1], 10)
  }
  const cl = headers['content-length']
  if (cl) {
    const n = parseInt(cl, 10)
    if (Number.isFinite(n)) return n + offset
  }
  return undefined
}

async function hashFile(path: string): Promise<string> {
  const { createReadStream } = await import('fs')
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (c) => hash.update(c))
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return hash.digest('hex')
}
