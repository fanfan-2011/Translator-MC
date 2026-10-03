import { useEffect, useState } from 'react'
import { History as HistoryIcon, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Badge, Button, Checkbox, CodeChip, EmptyState } from '../ui'

const SOURCE_LABEL: Record<HistoryEntry['source'], string> = {
  ai: 'AI',
  human: '人工',
  ai_review: 'AI 审校',
  builtin: '自带'
}

/**
 * 来源徽章沿用 UI-SPEC 1.5 的状态徽章配色（与 lib/status.ts 同一套 --tsm-st-* 变量），
 * 亮暗两套由 CSS 变量切换，不写死颜色。
 */
const SOURCE_BADGE: Record<HistoryEntry['source'], string> = {
  ai: 'bg-[var(--tsm-st-ai-bg)] text-[var(--tsm-st-ai-fg)]',
  human: 'bg-[var(--tsm-st-human-bg)] text-[var(--tsm-st-human-fg)]',
  ai_review: 'bg-[var(--tsm-st-review-bg)] text-[var(--tsm-st-review-fg)]',
  builtin: 'bg-[var(--tsm-st-builtin-bg)] text-[var(--tsm-st-builtin-fg)]'
}

/**
 * 翻译历史 —— 列表页模板（UI-SPEC 第 6 节）：
 * 操作栏（h71 / bg-surface-2 / rounded-panel / border-line）承载标题、统计 chip 与操作，
 * 下方是 h41 表头 + h37 行的表格卡片（rounded-card + border-line）。
 */
export function HistoryPanel(): JSX.Element {
  const projectId = useApp((s) => s.currentProjectId)
  const [rows, setRows] = useState<(HistoryEntry & { key: string })[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const reload = (): void => {
    if (projectId) void api.listAllHistory(projectId).then(setRows)
    else setRows([])
    setSelected(new Set())
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected((prev) =>
      rows.length > 0 && prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))
    )
  }

  const deleteSelected = async (): Promise<void> => {
    if (selected.size === 0) return
    if (window.confirm(`确定删除选中的 ${selected.size} 条历史记录吗？`)) {
      await api.deleteHistoryMany([...selected], projectId ?? undefined)
      reload()
    }
  }

  const clearAll = async (): Promise<void> => {
    if (rows.length === 0) return
    if (window.confirm(`确定清空当前项目的全部 ${rows.length} 条历史记录吗？此操作不可撤销。`)) {
      await api.deleteHistoryMany([], projectId ?? undefined)
      reload()
    }
  }

  const allChecked = rows.length > 0 && selected.size === rows.length

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 操作栏 —— h71，承载标题 / 统计 chip / 操作 */}
      <div className="flex h-[71px] shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <h2 className="text-lg font-semibold leading-5 text-ink">翻译历史</h2>
          <span className="truncate-1 text-xs font-normal text-muted">
            显示当前项目最近的 1000 条译文变动记录（来源：AI / 人工 / AI 审校 / 自带）。
          </span>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-primary-line bg-primary-soft px-3 text-sm font-semibold text-ink">
          共 {rows.length} 条
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={selected.size === 0}
          onClick={() => void deleteSelected()}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          删除选中{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
        {/* 危险操作：文字按钮（UI-SPEC 第 6 节第 6 条），二次确认写在 clearAll 里 */}
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => void clearAll()}
          className="app-nodrag inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-medium text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          清空全部
        </button>
      </div>

      {/* 表格卡片 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-6 w-6" strokeWidth={1.7} />}
            title={projectId ? '暂无翻译历史' : '请先打开一个项目'}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full table-fixed border-collapse">
              <thead className="text-xs font-semibold text-muted-2">
                <tr className="h-[41px]">
                  <th className="sticky top-0 z-10 w-11 border-b border-line bg-surface-4 pl-3 pr-0 text-left">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={selected.size > 0 && !allChecked}
                      onChange={toggleAll}
                      title="全选"
                    />
                  </th>
                  <th className="sticky top-0 z-10 w-[280px] border-b border-line bg-surface-4 px-3 text-left">Key</th>
                  <th className="sticky top-0 z-10 w-20 border-b border-line bg-surface-4 px-3 text-left">版本</th>
                  <th className="sticky top-0 z-10 w-24 border-b border-line bg-surface-4 px-3 text-left">来源</th>
                  <th className="sticky top-0 z-10 border-b border-line bg-surface-4 px-3 text-left">译文</th>
                  <th className="sticky top-0 z-10 w-[172px] border-b border-line bg-surface-4 px-3 text-left">时间</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="h-[37px] border-b border-line-row even:bg-alt hover:bg-hover">
                    <td className="pl-3 pr-0 align-middle">
                      <Checkbox checked={selected.has(h.id)} onChange={() => toggle(h.id)} />
                    </td>
                    <td className="px-3 align-middle">
                      <CodeChip title={h.key} className="max-w-full">
                        {h.key}
                      </CodeChip>
                    </td>
                    <td className="px-3 align-middle font-machine text-xs text-muted">v{h.version}</td>
                    <td className="px-3 align-middle">
                      <Badge className={SOURCE_BADGE[h.source]}>{SOURCE_LABEL[h.source]}</Badge>
                    </td>
                    <td className="px-3 align-middle">
                      <div className="truncate-1 text-xs text-ink-4" title={h.value}>
                        {h.value}
                      </div>
                    </td>
                    <td className="px-3 align-middle font-machine text-xs text-muted-3">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
