import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import type { LogLine } from '@shared/types'
import { api } from '../../api'
import { Button, EmptyState } from '../ui'

/**
 * 级别配色：DEBUG / INFO 走中性文字令牌，ERROR 走 danger，
 * WARN 用 UI-SPEC 1.5 的「需要关注」暖色变量（亮暗两套）。
 */
const LEVEL_COLOR: Record<LogLine['level'], string> = {
  DEBUG: 'text-muted-4',
  INFO: 'text-muted',
  WARN: 'text-[var(--tsm-st-attention-fg)]',
  ERROR: 'text-danger'
}

/**
 * 开发者日志 —— 列表页模板（UI-SPEC 第 6 节）：
 * 操作栏（h71 / bg-surface-2 / rounded-panel）+ 代码底色的日志卡片。
 * 时间戳与级别用 font-mono，日志内容可选中复制。
 */
export function LogsPanel(): JSX.Element {
  const [logs, setLogs] = useState<LogLine[]>([])

  const refresh = (): void => {
    void api.getLogs().then(setLogs)
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 操作栏 */}
      <div className="flex h-[71px] shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
        <h2 className="text-lg font-semibold leading-5 text-ink">开发者日志</h2>
        <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-primary-line bg-primary-soft px-3 text-sm font-semibold text-ink">
          共 {logs.length} 条
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={logs.length === 0}
          onClick={() => void api.clearLogs().then(() => setLogs([]))}
        >
          清空
        </Button>
      </div>

      {/* 日志卡片 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
        {logs.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" strokeWidth={1.7} />} title="暂无日志" />
        ) : (
          <div className="selectable min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-muted-3">{l.ts.slice(11, 19)}</span>
                <span className={`w-12 shrink-0 font-semibold ${LEVEL_COLOR[l.level]}`}>{l.level}</span>
                <span className="break-all text-ink-3">{l.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
