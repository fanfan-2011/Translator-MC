import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { IssueRecord } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Modal } from '../ui'

const ISSUE_LABEL: Record<string, string> = {
  placeholder: '占位符错误',
  format_code: '格式代码',
  terminology: '术语冲突',
  quality: '质量',
  empty: '空翻译',
  duplicate_key: '重复 Key',
  missing: '缺失译文',
  failed: '翻译失败',
  json: 'JSON 异常'
}

export function IssuesPanel(): JSX.Element {
  const open = useApp((s) => s.issueOpen)
  const setOpen = useApp((s) => s.setIssueOpen)
  const projectId = useApp((s) => s.currentProjectId)
  const entries = useApp((s) => s.entries)
  const [issues, setIssues] = useState<IssueRecord[]>([])

  useEffect(() => {
    if (open && projectId) void api.listIssues(projectId).then(setIssues)
  }, [open, projectId])

  const keyOf = (entryId: string): string => entries.find((e) => e.id === entryId)?.key ?? entryId

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="问题中心" width="max-w-2xl">
      {issues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-400">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          没有待处理的问题
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((i) => (
            <div
              key={i.id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                i.resolved
                  ? 'border-slate-100 opacity-50 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {ISSUE_LABEL[i.type] ?? i.type}
                </div>
                <div className="truncate font-mono text-xs text-slate-500" title={keyOf(i.entryId)}>
                  {keyOf(i.entryId)}
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{i.message}</div>
              </div>
              <button
                onClick={() => void api.setIssueResolved(i.id, !i.resolved).then(() => api.listIssues(projectId!).then(setIssues))}
                className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
              >
                {i.resolved ? '撤销' : '标记已解决'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
