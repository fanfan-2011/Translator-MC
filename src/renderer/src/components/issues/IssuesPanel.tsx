import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { IssueRecord } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { CodeChip, EmptyState, Modal } from '../ui'

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

/**
 * 问题中心 —— 弹层（UI-SPEC 第 6 节）：Modal 本身即 bg-surface + border-line +
 * rounded-card；内部每条问题是一张卡片（rounded-sm + border-line + shadow-card），
 * 未解决带警示图标，已解决整体降透明度。空状态用 EmptyState。
 */
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
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" strokeWidth={1.7} />}
          title="没有待处理的问题"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {issues.map((i) => (
            <div
              key={i.id}
              className={`flex items-start gap-3 rounded-sm border border-line bg-surface p-3 transition-colors ${
                i.resolved ? 'opacity-50' : 'shadow-card'
              }`}
            >
              {i.resolved ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" strokeWidth={1.8} />
              ) : (
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tsm-st-attention-fg)]"
                  strokeWidth={1.8}
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="text-base font-semibold text-ink">{ISSUE_LABEL[i.type] ?? i.type}</div>
                <CodeChip title={keyOf(i.entryId)} className="max-w-full">
                  {keyOf(i.entryId)}
                </CodeChip>
                <div className="text-xs text-muted">{i.message}</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void api.setIssueResolved(i.id, !i.resolved).then(() => api.listIssues(projectId!).then(setIssues))
                }
                className={`app-nodrag h-7 shrink-0 rounded-full px-2.5 text-xs font-medium transition-colors ${
                  i.resolved
                    ? 'text-muted hover:bg-hover hover:text-ink'
                    : 'text-primary-ink hover:bg-primary-soft'
                }`}
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
