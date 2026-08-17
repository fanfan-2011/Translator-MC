import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AlertTriangle } from 'lucide-react'
import type { TranslationEntry } from '@shared/types'
import { STATUS_LABEL, STATUS_STYLE } from '../../lib/status'
import { Badge, Checkbox } from '../ui'

const ROW_HEIGHT = 40

export interface TableHandlers {
  onToggleSelect: (id: string, selected: boolean) => void
  onToggleSelectAll: (ids: string[], selected: boolean) => void
  onEditTarget: (id: string, target: string) => void
  onClearTarget: (id: string) => void
}

export function TranslationTable({
  entries,
  handlers
}: {
  entries: TranslationEntry[]
  handlers: TableHandlers
}): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  })

  const selectedCount = entries.filter((e) => e.selected).length
  const allSelected = entries.length > 0 && selectedCount === entries.length
  const someSelected = selectedCount > 0 && !allSelected

  const commit = (): void => {
    if (editingId) {
      handlers.onEditTarget(editingId, draft)
      setEditingId(null)
    }
  }

  const startEdit = (e: TranslationEntry): void => {
    setEditingId(e.id)
    setDraft(e.targetText ?? '')
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex h-9 shrink-0 items-center border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        <div className="flex w-10 shrink-0 items-center justify-center">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(v) => handlers.onToggleSelectAll(entries.map((e) => e.id), v)}
          />
        </div>
        <div className="w-24 shrink-0">状态</div>
        <div className="w-1/4 min-w-0 shrink-0 px-2">Key</div>
        <div className="w-1/4 min-w-0 shrink-0 px-2">原文</div>
        <div className="flex-1 min-w-0 px-2">译文（点击编辑）</div>
        <div className="w-20 shrink-0 px-2 text-right">质量</div>
      </div>

      {/* body */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const e = entries[vRow.index]
            const isEditing = editingId === e.id
            const hasIssues = e.issues.length > 0
            return (
              <div
                key={e.id}
                className={`absolute left-0 flex w-full items-center border-b border-slate-100 text-sm dark:border-slate-800 ${
                  e.selected ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''
                }`}
                style={{ top: 0, transform: `translateY(${vRow.start}px)`, height: ROW_HEIGHT }}
              >
                <div className="flex w-10 shrink-0 items-center justify-center">
                  <Checkbox
                    checked={e.selected}
                    onChange={(v) => handlers.onToggleSelect(e.id, v)}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Badge className={STATUS_STYLE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </div>
                <div className="w-1/4 min-w-0 shrink-0 truncate px-2 font-mono text-xs text-slate-600 dark:text-slate-300" title={e.key}>
                  {e.key}
                </div>
                <div className="w-1/4 min-w-0 shrink-0 truncate px-2 text-slate-700 dark:text-slate-200" title={e.sourceText}>
                  {e.sourceText}
                </div>
                <div className="flex-1 min-w-0 px-2" onDoubleClick={() => startEdit(e)}>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(ev) => setDraft(ev.target.value)}
                      onBlur={commit}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') commit()
                        if (ev.key === 'Escape') setEditingId(null)
                      }}
                      className="w-full rounded border border-primary-400 px-1.5 py-0.5 text-sm outline-none"
                    />
                  ) : (
                    <div
                      className={`cursor-text truncate ${
                        e.targetText
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'italic text-slate-300 dark:text-slate-600'
                      }`}
                      title={e.targetText || '点击或双击编辑'}
                    >
                      {e.targetText || '未翻译'}
                    </div>
                  )}
                </div>
                <div className="flex w-20 shrink-0 items-center justify-end gap-1 px-2">
                  {hasIssues ? (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500" title={e.issues.map((i) => i.message).join('\n')}>
                      <AlertTriangle className="h-3 w-3" />
                      {e.issues.length}
                    </span>
                  ) : null}
                  {e.qualityScore != null ? (
                    <span
                      className={`text-xs font-medium ${
                        e.qualityScore >= 70 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {e.qualityScore}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
