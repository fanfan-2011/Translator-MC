import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, type UpdateProgressState, type UpdateSource } from '../../api'

/**
 * 下载进度窗口 —— Figma 63:282（Updating-GitHub）/ 63:316（Updating-GitCode），417×202
 *   · 外框 r9，底 #f9f3df，内边距 16，纵向 gap12
 *   · header 32：标题 22 Bold（「正在尝试从 GitHub 下载……」）+ 右上关闭 32×32 r8
 *   · 「请耐心等待」14 SemiBold
 *   · 「下载进度」12 Regular #6b6b6b + 进度条 385×12（r999，轨道 #e7d8b8 / 填充 #1f1f1f）
 *   · 进度元信息 13 Bold：左「12MB/s　64MB/160MB」右「40%」
 *   · 右下「取消」72×43 r14（白底 + 描边 #d8c9a8）
 *
 * 这个组件是**独立窗口**（主窗口在更新开始时被隐藏），由 `?window=update` 分支挂载。
 * 取消 / 叉号都会调 `update:cancel`：中断下载 + 关本窗口 + 恢复主窗口（需求 6）。
 */
export function UpdateProgressWindow({ demoState }: { demoState?: UpdateProgressState } = {}): JSX.Element {
  const [source, setSource] = useState<UpdateSource>('github')
  const [state, setState] = useState<UpdateProgressState | null>(null)
  /** 根容器引用：量「内容是否装得下」要量它，不是 body（根是 h-full，body 永远不会溢出） */
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // 测试脚手架传入状态时（design 比对用）不订阅主进程事件
    if (demoState) return
    let alive = true
    // 窗口刚挂载时先拉一次快照（早期进度事件可能已经发过了）
    void api.getUpdateState().then((s) => {
      if (!alive) return
      setState(s)
      if (s.source) setSource(s.source)
    })
    const offProgress = api.onUpdateProgress((s) => {
      setState(s)
      if (s.source) setSource(s.source)
    })
    const offFinish = api.onUpdateFinish((s) => setState(s))
    const offSource = api.onUpdateSource((d) => setSource(d.source))
    return () => {
      alive = false
      offProgress()
      offFinish()
      offSource()
    }
  }, [])

  // 内容装不下时把窗口撑大（**只增不减**，主进程侧保证单调收敛 → 数学上不会震荡）。
  // 注意两点：① 窗口显示前 innerWidth/innerHeight 报的是未生效值，必须等可见后再量；
  // ② 只在「需要 > 当前」时才调，绝不请求缩小。
  useEffect(() => {
    if (demoState) return
    let cancelled = false
    let round = 0
    let waits = 0
    const step = (): void => {
      if (cancelled) return
      if (document.visibilityState !== 'visible') {
        if (waits++ < 75) window.setTimeout(step, 200)
        return
      }
      if (round++ > 6) return
      // 量根容器（不是 body）：body 是 h-full，永不溢出；真正的溢出发生在根容器内部。
      const el = rootRef.current
      const neededWidth = Math.max(417, el ? el.scrollWidth : document.body.scrollWidth)
      const neededHeight = Math.max(226, el ? el.scrollHeight : document.body.scrollHeight)
      const innerW = el ? el.clientWidth : window.innerWidth
      const innerH = el ? el.clientHeight : window.innerHeight
      if (neededWidth <= innerW + 1 && neededHeight <= innerH + 1) return
      void api.fitUpdateWindow({ innerWidth: innerW, innerHeight: innerH, neededWidth, neededHeight })
      window.setTimeout(step, 200)
    }
    step()
    return () => {
      cancelled = true
    }
    // 依赖 state?.phase：失败界面比下载中多一行按钮，阶段一变就要重新量一次（只增不减，不会震荡）
  }, [demoState, state?.phase])

  const live = demoState ?? state
  const phase = live?.phase ?? 'downloading'
  const received = live?.received ?? 0
  const total = live?.total ?? 0
  const percent = live?.percent ?? (total ? Math.round((received / total) * 100) : 0)
  const speedMb = ((live?.speed ?? 0) / 1048576).toFixed(1)
  const toMb = (n: number): string => (n / 1048576).toFixed(0)
  const sourceName = source === 'gitcode' ? 'GitCode' : 'GitHub'
  /** 失败与「已取消」都给同样的出路：重试 / 打开下载页 / 打开文件夹 */
  const failed = phase === 'error' || phase === 'cancelled'

  const title =
    phase === 'done'
      ? '下载完成，正在打开安装包……'
      : phase === 'error'
        ? '下载失败'
        : phase === 'cancelled'
          ? '已取消更新'
          : `正在尝试从 ${sourceName} 下载……`

  const cancel = (): void => {
    void api.cancelUpdate()
  }

  /** 重试：用同一来源与安装包类型重来（分片还在 → 自动从断点续传） */
  const retry = (): void => {
    void api.startUpdate({
      source: live?.source ?? source,
      kind: live?.kind ?? 'exe',
      remember: false,
      backup: false
    })
  }

  return (
    <div
      ref={rootRef}
      className="app-drag flex h-full w-full flex-col gap-2.5 overflow-hidden bg-upd-bg p-4"
    >
      {/* header */}
      <div className="flex h-8 items-center justify-between gap-2">
        <div className="truncate-1 text-[19px] font-bold leading-6 text-upd-ink">{title}</div>
        <button
          type="button"
          onClick={cancel}
          aria-label="关闭"
          className="app-nodrag flex h-8 w-8 shrink-0 items-center justify-center rounded-win text-upd-ink transition-colors hover:bg-[rgba(31,31,31,0.07)]"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      </div>

      {/* 错误原因：最多两行，悬停可看全文（不占满窗口，也不冒出滚动条） */}
      {phase === 'error' && live?.error ? (
        <div
          title={live.error}
          className="break-all text-xs leading-4 text-upd-muted"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {live.error}
        </div>
      ) : null}

      <div className="text-sm font-semibold text-upd-ink">
        {phase === 'downloading'
          ? '请耐心等待'
          : phase === 'done'
            ? '即将回到主界面'
            : failed
              ? '可重试，或手动处理'
              : '可以关闭此窗口'}
      </div>

      {/* progress */}
      <div className="flex flex-col gap-2">
        <div className="text-xs text-upd-muted">下载进度</div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-upd-track">
          <div
            className="h-full rounded-full bg-upd-fill transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
      </div>

      {/* meta */}
      <div className="flex h-4 items-center justify-between text-sm font-bold text-upd-ink">
        <span>
          {speedMb}MB/s&nbsp;&nbsp;&nbsp;{toMb(received)}MB/{toMb(total)}MB
        </span>
        <span>{percent}%</span>
      </div>

      {/* footer */}
      {failed ? (
        <div className="flex flex-1 items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void api.openUpdatePage()}
              className="app-nodrag h-8 shrink-0 rounded-win border border-upd-line-2 bg-upd-white px-3 text-[13px] font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98]"
            >
              打开下载页
            </button>
            <button
              type="button"
              onClick={() => void api.openUpdateFolder()}
              className="app-nodrag h-8 shrink-0 rounded-win border border-upd-line-2 bg-upd-white px-3 text-[13px] font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98]"
            >
              打开文件夹
            </button>
          </div>
          <button
            type="button"
            onClick={retry}
            className="app-nodrag h-[43px] w-[72px] shrink-0 rounded-tile border border-upd-line-2 bg-upd-white text-lg font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98]"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-end justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={phase === 'done'}
            className="app-nodrag h-[43px] w-[72px] rounded-tile border border-upd-line-2 bg-upd-white text-lg font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98] disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
