import { useEffect, useState } from 'react'
import type { HistoryEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button } from '../ui'

const SOURCE_LABEL: Record<HistoryEntry['source'], string> = {
  ai: 'AI',
  human: '人工',
  ai_review: 'AI 审校',
  builtin: '自带'
}

const SOURCE_STYLE: Record<HistoryEntry['source'], string> = {
  ai: 'bg-indigo-100 text-indigo-700',
  human: 'bg-emerald-100 text-emerald-700',
  ai_review: 'bg-amber-100 text-amber-700',
  builtin: 'bg-teal-100 text-teal-700'
}

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
      await api.deleteHistoryMany([...selected])
      reload()
    }
  }

  const clearAll = async (): Promise<void> => {
    if (rows.length === 0) return
    if (window.confirm(`确定清空当前项目的全部 ${rows.length} 条历史记录吗？此操作不可撤销。`)) {
      await api.deleteHistoryMany([])
      reload()
    }
  }

  const allChecked = rows.length > 0 && selected.size === rows.length

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">翻译历史</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="danger" disabled={selected.size === 0} onClick={() => void deleteSelected()}>
            删除选中{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button size="sm" disabled={rows.length === 0} onClick={() => void clearAll()}>
            清空全部
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer"
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">Key</th>
              <th className="px-3 py-2 text-left font-medium">版本</th>
              <th className="px-3 py-2 text-left font-medium">来源</th>
              <th className="px-3 py-2 text-left font-medium">译文</th>
              <th className="px-3 py-2 text-left font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={selected.has(h.id)}
                    onChange={() => toggle(h.id)}
                  />
                </td>
                <td className="max-w-56 truncate px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-300" title={h.key}>
                  {h.key}
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-500">v{h.version}</td>
                <td className="px-3 py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${SOURCE_STYLE[h.source]}`}>
                    {SOURCE_LABEL[h.source]}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">{h.value}</td>
                <td className="px-3 py-1.5 text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  {projectId ? '暂无翻译历史' : '请先打开一个项目'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
