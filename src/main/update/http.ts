/**
 * 统一 HTTP 出口：一律走 **Electron 的 net**（Chromium 网络栈）。
 *
 * 【为什么不用 Node 的 fetch/undici —— 2026-10-06 兼容性审计的核心结论】
 * undici **不读 Windows 系统代理设置、不读 PAC 自动配置脚本、不读企业/校园网根证书**。
 * 在配了代理或有自签证书的电脑上，「检查更新」和「下载安装包」会直接失败 ——
 * 这正是「只有开发者这台电脑能用」的根因。
 * Electron 的 net 自动继承系统代理 / PAC / 系统证书库 / 系统 DNS 与 IPv6 回退，
 * 同一份代码在任何环境都能走通，无需用户配置任何东西。
 *
 * 其余约定：
 * - 默认跟随 302（两端资产都跳 CDN；GitCode 的 HEAD 会被拦成 401，所以一律 GET）；
 * - 超时按「空闲」计（每收到一块数据就重置），慢速但没断的大文件不会被误杀；
 * - 错误统一成 NetError，带 kind（timeout / network / http / aborted）供上层决定是否重试。
 */
import { net } from 'electron'
import type { ClientRequest, IncomingMessage } from 'electron'

export const UA = 'Translator-MC'

/** 单次请求的空闲超时（毫秒） */
export const DEFAULT_TIMEOUT_MS = 15_000

/**
 * 连接/重定向阶段的兜底超时：比空闲超时短。
 * 没有它的话，CDN 连不上（TCP 被丢弃、劫持到无响应地址）会一直干等到空闲超时，
 * 用户要盯着进度窗等半分钟才看到失败。
 */
export const CONNECT_TIMEOUT_MS = 10_000

export type NetErrorKind = 'timeout' | 'network' | 'http' | 'aborted'

export class NetError extends Error {
  constructor(
    message: string,
    readonly kind: NetErrorKind = 'network',
    readonly status?: number
  ) {
    super(message)
    this.name = 'NetError'
  }
}

export interface NetResponse {
  status: number
  /** 键全小写；多值用 ", " 连接（Electron 的 headers 是 string[]） */
  headers: Record<string, string>
  body: Buffer
}

/**
 * Electron 的 IncomingMessage 运行时实现了 Readable 接口（pause/resume/destroy 都有），
 * 但官方 .d.ts 没把这些方法写进去 → 这里补一个窄接口，避免到处写 as any。
 */
export type ReadableLike = IncomingMessage & {
  pause(): void
  resume(): void
  destroy(error?: Error): void
}

export interface CoreOptions {
  headers?: Record<string, string>
  /** 空闲超时；每收到数据就重置 */
  idleTimeoutMs?: number
  /** 取消令牌 */
  signal?: AbortSignal
}

/** Electron 的 headers 是 string[]，这里统一成小写单值，便于像 fetch 一样读 */
function normHeaders(raw?: Record<string, string[] | string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw ?? {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return out
}

function applyHeaders(request: ClientRequest, extra?: Record<string, string>): void {
  const seen = new Set<string>()
  for (const [k, v] of Object.entries(extra ?? {})) {
    request.setHeader(k, v)
    seen.add(k.toLowerCase())
  }
  if (!seen.has('user-agent')) request.setHeader('User-Agent', UA)
}

/**
 * 挂载超时 / 取消 / 错误分类的公共骨架。
 * `setup` 里只需关心正常路径（response / data / end）。
 */
function wire(
  request: ClientRequest,
  opts: CoreOptions,
  idleMs: number,
  hooks: {
    onResponse?: (res: IncomingMessage) => void
    /** 收到数据块（已刷新空闲计时） */
    onData?: (chunk: Buffer) => void
    onEnd?: () => void
    onFail: (e: NetError) => void
  }
): { clearTimer: () => void } {
  let settled = false
  let timedOut = false
  let stream: ReadableLike | null = null

  const timer = { id: null as ReturnType<typeof setTimeout> | null }
  const connectTimer = { id: null as ReturnType<typeof setTimeout> | null }
  const clearTimer = (): void => {
    if (timer.id) clearTimeout(timer.id)
    timer.id = null
    if (connectTimer.id) clearTimeout(connectTimer.id)
    connectTimer.id = null
  }
  const refresh = (): void => {
    clearTimer()
    timer.id = setTimeout(() => {
      timedOut = true
      try {
        request.abort()
      } catch {
        /* 已结束 */
      }
      finishFail(new NetError(`请求超时（${idleMs}ms 无数据）`, 'timeout'))
    }, idleMs)
  }
  function finishFail(e: NetError): void {
    if (settled) return
    settled = true
    clearTimer()
    opts.signal?.removeEventListener('abort', onAbort)
    hooks.onFail(e)
  }
  function finishEnd(): void {
    if (settled) return
    settled = true
    clearTimer()
    opts.signal?.removeEventListener('abort', onAbort)
    hooks.onEnd?.()
  }
  const onAbort = (): void => {
    try {
      request.abort()
    } catch {
      /* 已结束 */
    }
    try {
      stream?.destroy()
    } catch {
      /* 忽略 */
    }
  }
  if (opts.signal) {
    if (opts.signal.aborted) onAbort()
    else opts.signal.addEventListener('abort', onAbort, { once: true })
  }
  refresh()
  // 连接阶段的兜底：收到响应头就撤（之后由空闲超时接管）
  connectTimer.id = setTimeout(() => {
    timedOut = true
    try {
      request.abort()
    } catch {
      /* 已结束 */
    }
    finishFail(new NetError(`连接超时（${CONNECT_TIMEOUT_MS}ms 内未收到响应）`, 'timeout'))
  }, CONNECT_TIMEOUT_MS)

  request.on('response', (res) => {
    stream = res as ReadableLike
    if (connectTimer.id) {
      clearTimeout(connectTimer.id)
      connectTimer.id = null
    }
    hooks.onResponse?.(res)
    res.on('data', (chunk: Buffer) => {
      refresh()
      hooks.onData?.(Buffer.from(chunk))
    })
    res.on('end', () => finishEnd())
    res.on('aborted', () =>
      finishFail(new NetError('连接被中断', opts.signal?.aborted ? 'aborted' : 'network'))
    )
    res.on('error', (e: Error) => finishFail(new NetError(e.message, 'network')))
  })
  request.on('error', (e: Error) =>
    finishFail(
      new NetError(
        timedOut ? `请求超时（${idleMs}ms 无数据）` : e.message,
        timedOut ? 'timeout' : opts.signal?.aborted ? 'aborted' : 'network'
      )
    )
  )

  return { clearTimer }
}

/** GET 并缓冲整个响应体（JSON / 文本 / 大小探测用） */
export function httpGet(url: string, opts: CoreOptions = {}): Promise<NetResponse> {
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_TIMEOUT_MS
  return new Promise<NetResponse>((resolve, reject) => {
    const request = net.request({ method: 'GET', url, redirect: 'follow' })
    applyHeaders(request, opts.headers)
    let status = 0
    let headers: Record<string, string> = {}
    const chunks: Buffer[] = []

    wire(request, opts, idleMs, {
      onResponse: (res) => {
        status = res.statusCode ?? 0
        headers = normHeaders(res.headers as Record<string, string[] | string>)
      },
      onData: (chunk) => chunks.push(chunk),
      onEnd: () => resolve({ status, headers, body: Buffer.concat(chunks) }),
      onFail: reject
    })
    request.end()
  })
}

export interface StreamHandle {
  status: number
  headers: Record<string, string>
  /** 原始响应流：调用方自行挂 'data' 并做背压（write 返回 false 时 pause/resume） */
  stream: ReadableLike
}

/**
 * 流式 GET。把响应头与流交给调用方自己读（写盘需要背压控制），
 * 超时、取消、错误分类仍由本模块统一处理。
 */
export function httpStream(
  url: string,
  opts: CoreOptions & { onResponse: (h: StreamHandle) => void }
): Promise<void> {
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_TIMEOUT_MS
  return new Promise<void>((resolve, reject) => {
    const request = net.request({ method: 'GET', url, redirect: 'follow' })
    applyHeaders(request, opts.headers)
    wire(request, opts, idleMs, {
      onResponse: (res) =>
        opts.onResponse({
          status: res.statusCode ?? 0,
          headers: normHeaders(res.headers as Record<string, string[] | string>),
          stream: res as ReadableLike
        }),
      onEnd: () => resolve(),
      onFail: reject
    })
    request.end()
  })
}

/**
 * 只取一次重定向的落点（GitHub 的 `/releases/latest` 靠它拿最新正式 tag，免 API 配额）。
 * 不跟随跳转，拿到 Location 立即中止。
 */
export function httpRedirectTarget(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    let done = false
    const finish = (v: string | undefined): void => {
      if (done) return
      done = true
      resolve(v)
    }
    const request = net.request({ method: 'GET', url, redirect: 'manual' })
    applyHeaders(request)
    const t = setTimeout(() => {
      try {
        request.abort()
      } catch {
        /* 忽略 */
      }
      finish(undefined)
    }, timeoutMs)
    request.on('redirect', (_status, _method, redirectUrl) => {
      clearTimeout(t)
      finish(redirectUrl)
      try {
        request.abort()
      } catch {
        /* 忽略 */
      }
    })
    request.on('response', () => {
      clearTimeout(t)
      finish(undefined)
    })
    request.on('error', () => {
      clearTimeout(t)
      finish(undefined)
    })
    request.end()
  })
}

// ---------- 重试（需求：网络抖一下不该让整次更新失败） ----------

export const RETRY_DELAYS = [1000, 3000, 7000]

/** 是否值得重试：网络类/超时/5xx/429 值得；4xx 与主动取消不值得 */
export function isRetryable(e: unknown): boolean {
  if (e instanceof NetError) {
    if (e.kind === 'aborted') return false
    if (e.kind === 'timeout' || e.kind === 'network') return true
    if (e.kind === 'http') return !!e.status && (e.status >= 500 || e.status === 429)
    return false
  }
  return false
}

function sleepSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true }
    )
  })
}

/** 带退避的重试；最后一次仍失败则抛出原错误 */
export async function withRetry<T>(
  label: string,
  fn: (attempt: number) => Promise<T>,
  opts: { attempts?: number; signal?: AbortSignal; retryable?: (e: unknown) => boolean } = {}
): Promise<T> {
  const attempts = opts.attempts ?? RETRY_DELAYS.length + 1
  const retryable = opts.retryable ?? isRetryable
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) throw new NetError(`${label}：已取消`, 'aborted')
    try {
      return await fn(i)
    } catch (e) {
      last = e
      const isLast = i === attempts - 1
      if (isLast || !retryable(e)) throw e
      await sleepSignal(RETRY_DELAYS[Math.min(i, RETRY_DELAYS.length - 1)], opts.signal)
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/** 便捷：GET 后按状态码判定成败 */
export async function httpGetOk(
  url: string,
  opts: CoreOptions = {}
): Promise<NetResponse> {
  const res = await httpGet(url, opts)
  if (res.status < 200 || res.status >= 300) throw new NetError(`HTTP ${res.status}`, 'http', res.status)
  return res
}

export function textOf(res: NetResponse): string {
  return res.body.toString('utf8')
}

export function jsonOf<T>(res: NetResponse): T {
  return JSON.parse(res.body.toString('utf8')) as T
}
