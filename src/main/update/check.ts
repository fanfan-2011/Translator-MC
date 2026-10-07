/**
 * 更新检查：并发查两端 → 取较新的一端（用户裁决：取较新的一端并标注来源）。
 * 网络失败一律**只记录、不打扰**（返回 errors[]，由调用方写日志）。
 */
import type { CheckResult, ReleaseInfo, SourceError, UpdateSource } from './types'
import { compareDesc, isNewer } from './semver'
import { fetchRelease } from './sources'

/** 自动检查间隔：10 分钟（需求 1） */
export const AUTO_CHECK_INTERVAL_MS = 10 * 60 * 1000

const SOURCES: UpdateSource[] = ['github', 'gitcode']

/**
 * 单个来源的**总时限**。一条通道挂掉（被墙 / 超时 / 重试）不能拖住整次检查 ——
 * 实测屏蔽 api.github.com 时，原来的实现要 **36 秒**才出结果（另一条通道 1 秒就好了）。
 * 到点就放弃这一端，用已经拿到的结果继续。
 */
export const SOURCE_DEADLINE_MS = 10_000

function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} 超过 ${Math.round(ms / 1000)} 秒未返回`)), ms)
    )
  ])
}

export interface CheckOptions {
  /** 两端版本相同时优先选它（用户上次实际用过的下载源） */
  preferSource?: UpdateSource | null
}

/** 并发查两端；任一端失败/超时都不影响另一端 */
export async function checkForUpdate(current: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const settled = await Promise.all(
    SOURCES.map(
      async (source): Promise<{ source: UpdateSource; info?: ReleaseInfo; error?: string; ms: number }> => {
        const t0 = Date.now()
        try {
          return { source, info: await withDeadline(fetchRelease(source), SOURCE_DEADLINE_MS, source), ms: Date.now() - t0 }
        } catch (e) {
          return { source, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }
        }
      }
    )
  )

  const perSource: CheckResult['perSource'] = { github: null, gitcode: null }
  const errors: SourceError[] = []
  const cost: Record<UpdateSource, number> = { github: Number.POSITIVE_INFINITY, gitcode: Number.POSITIVE_INFINITY }
  for (const r of settled) {
    cost[r.source] = r.ms
    if (r.info) perSource[r.source] = r.info
    else if (r.error) errors.push({ source: r.source, message: r.error })
  }

  const present = [perSource.github, perSource.gitcode].filter((x): x is ReleaseInfo => x !== null)
  const newer = present.filter((p) => isNewer(p.version, current)).sort((a, b) => {
    const byVersion = compareDesc(a.version, b.version)
    if (byVersion !== 0) return byVersion
    // 版本相同（两端都发同一版）时，别默认选 GitHub —— 国内实测 GitHub 只有 0.1MB/s 还会断连。
    // 优先用户上次真正用过的来源；没有记录就选这次响应更快的那个。
    const pref = opts.preferSource
    if (pref) {
      if (a.source === pref && b.source !== pref) return -1
      if (b.source === pref && a.source !== pref) return 1
    }
    return cost[a.source] - cost[b.source]
  })
  const best = newer[0]

  return {
    current,
    available: !!best,
    best,
    perSource,
    errors,
    checkedAt: Date.now()
  }
}

export interface AutoCheckOptions {
  current: string
  /** 默认 10 分钟 */
  intervalMs?: number
  /** 读取「优先来源」（每次检查时现读，用户换了偏好立刻生效） */
  preferSource?: () => UpdateSource | null
  /** 每次检查完成（含"已是最新"） */
  onResult?: (result: CheckResult) => void
  /** 发现版本变化时（同一次会话内同一版本只报一次） */
  onNewVersion?: (result: CheckResult) => void
}

export interface AutoCheckHandle {
  /** 立即检查一次 */
  kick: () => Promise<CheckResult>
  stop: () => void
}

/** 启动即查一次，之后每 intervalMs 查一次（需求 1） */
export function startAutoCheck(opts: AutoCheckOptions): AutoCheckHandle {
  const intervalMs = opts.intervalMs ?? AUTO_CHECK_INTERVAL_MS
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false
  let notifiedVersion: string | null = null

  const kick = async (): Promise<CheckResult> => {
    if (running) return { current: opts.current, available: false, perSource: { github: null, gitcode: null }, errors: [], checkedAt: Date.now() }
    running = true
    try {
      const result = await checkForUpdate(opts.current, { preferSource: opts.preferSource?.() ?? null })
      opts.onResult?.(result)
      const v = result.best?.version ?? null
      if (v && v !== notifiedVersion) {
        notifiedVersion = v
        opts.onNewVersion?.(result)
      }
      return result
    } finally {
      running = false
    }
  }

  void kick()
  timer = setInterval(() => void kick(), intervalMs)

  return {
    kick,
    stop: () => {
      if (timer) clearInterval(timer)
      timer = null
    }
  }
}
