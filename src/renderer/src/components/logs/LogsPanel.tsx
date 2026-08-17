import { useEffect, useState } from 'react'
import type { LogLine } from '@shared/types'
import { api } from '../../api'
import { Button } from '../ui'

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  DEBUG: 'text-slate-400',
  INFO: 'text-slate-500',
  WARN: 'text-amber-500',
  ERROR: 'text-red-500'
}

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
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">开发者日志</h2>
        <Button size="sm" onClick={() => void api.clearLogs().then(() => setLogs([]))}>
          清空
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-xs">
        {logs.map((l, i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="shrink-0 text-slate-600">{l.ts.slice(11, 19)}</span>
            <span className={`shrink-0 font-semibold ${LEVEL_COLOR[l.level]}`}>{l.level}</span>
            <span className="break-all text-slate-300">{l.message}</span>
          </div>
        ))}
        {logs.length === 0 ? <div className="text-slate-500">暂无日志</div> : null}
      </div>
    </div>
  )
}
