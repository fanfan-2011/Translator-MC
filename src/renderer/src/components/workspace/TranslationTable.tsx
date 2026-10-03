import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TranslationEntry } from '@shared/types'
import { ATTENTION_BADGE, STATUS_BADGE, STATUS_LABEL } from '../../lib/status'
import { Badge, Checkbox, CodeChip } from '../ui'

/** 行高固定 37（设计稿 45:27 实测），虚拟滚动靠它算总高 */
const ROW_HEIGHT = 37

export interface TableHandlers {
  onToggleSelect: (id: string, selected: boolean) => void
  onToggleSelectAll: (ids: string[], selected: boolean) => void
  onEditTarget: (id: string, target: string) => void
  onClearTarget: (id: string) => void
}

/**
 * 表格 —— 设计稿 45:14（表头 h41 / #f7f7fa / 12px SemiBold #666b78）+
 * 45:27…（行 h37，奇行 #fcfcff，底边 1px #f0f1f2）。
 * 列宽：36 / 84 / 180 / 280 / 自适应 / 88。
 */
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
    overscan: 14
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
    <div className="flex h-full min-h-0 flex-col">
      {/* 表头 */}
      <div className="flex h-[41px] shrink-0 items-center border-b border-line bg-surface-4 text-xs font-semibold text-muted-2">
        <div className="flex w-9 shrink-0 items-center justify-center">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            title="全选"
            onChange={(v) => handlers.onToggleSelectAll(entries.map((e) => e.id), v)}
          />
        </div>
        <div className="w-[84px] shrink-0 pl-1">状态</div>
        <div className="w-[180px] shrink-0 pl-1">Key</div>
        <div className="w-[280px] shrink-0 pl-1">原文</div>
        <div className="min-w-0 flex-1 pl-1">译文（点击编辑）</div>
        <div className="flex w-[88px] shrink-0 items-center justify-center">质量</div>
      </div>

      {/* 表体 */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const e = entries[vRow.index]
            const isEditing = editingId === e.id
            const odd = vRow.index % 2 === 1
            return (
              <div
                key={e.id}
                className={`absolute left-0 flex w-full items-center border-b border-line-row ${
                  e.selected ? 'bg-selected' : odd ? 'bg-alt' : 'bg-surface'
                } hover:bg-hover`}
                style={{ top: 0, transform: `translateY(${vRow.start}px)`, height: ROW_HEIGHT }}
              >
                <div className="flex w-9 shrink-0 items-center justify-center">
                  <Checkbox checked={e.selected} onChange={(v) => handlers.onToggleSelect(e.id, v)} />
                </div>

                <div className="flex w-[84px] shrink-0 items-center pl-1">
                  <Badge className={STATUS_BADGE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </div>

                <div className="w-[180px] shrink-0 pl-1 pr-2">
                  <CodeChip title={e.key}>{e.key}</CodeChip>
                </div>

                <div className="w-[280px] shrink-0 truncate-1 pl-1 pr-2 text-xs text-ink-4" title={e.sourceText}>
                  {e.sourceText}
                </div>

                <div className="min-w-0 flex-1 pl-1 pr-2">
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
                      className="h-6 w-full rounded-chip border border-accent bg-surface px-1.5 text-xs text-ink outline-none selectable"
                    />
                  ) : (
                    <div
                      onClick={() => startEdit(e)}
                      className={`cursor-text truncate-1 text-xs ${
                        e.targetText ? 'text-target' : 'text-muted-4'
                      }`}
                      title={e.targetText || '点击编辑'}
                    >
                      {e.targetText || '未翻译'}
                    </div>
                  )}
                </div>

                <div className="flex w-[88px] shrink-0 items-center justify-center gap-1.5">
                  {e.issues.length > 0 ? (
                    <Badge className={ATTENTION_BADGE} title={e.issues.map((i) => i.message).join('\n')}>
                      需要关注
                    </Badge>
                  ) : e.qualityScore != null ? (
                    <span
                      className={`text-xs font-semibold ${
                        e.qualityScore >= 70 ? 'text-primary-ink' : 'text-danger'
                      }`}
                    >
                      {e.qualityScore}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-5">待审</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
