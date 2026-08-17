import { useEffect, useState } from 'react'
import { targetLanguageName, type MemoryEntry } from '@shared/types'
import { api } from '../../api'
import { PACKAGE_LABEL } from '../../lib/status'
import { Button } from '../ui'

export function MemoryPanel(): JSX.Element {
  const [memory, setMemory] = useState<MemoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const reload = (): void => {
    void api.listMemory().then(setMemory)
    setSelected(new Set())
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = memory.filter(
    (m) =>
      !search ||
      m.sourceText.toLowerCase().includes(search.toLowerCase()) ||
      m.targetText.toLowerCase().includes(search.toLowerCase())
  )

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
      filtered.length > 0 && prev.size === filtered.length ? new Set() : new Set(filtered.map((m) => m.id))
    )
  }

  const deleteSelected = async (): Promise<void> => {
    if (selected.size === 0) return
    if (window.confirm(`确定删除选中的 ${selected.size} 条翻译记忆吗？`)) {
      await api.deleteMemoryMany([...selected])
      reload()
    }
  }

  const clearAll = async (): Promise<void> => {
    if (memory.length === 0) return
    if (window.confirm(`确定清空全部 ${memory.length} 条翻译记忆吗？此操作不可撤销。`)) {
      await api.deleteMemoryMany([])
      reload()
    }
  }

  const allChecked = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">翻译记忆</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="danger" disabled={selected.size === 0} onClick={() => void deleteSelected()}>
            删除选中{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button size="sm" disabled={memory.length === 0} onClick={() => void clearAll()}>
            清空全部
          </Button>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-400">
        翻译记忆会在后续翻译中自动复用完全相同的原文，共 {memory.length} 条。
      </p>
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
                  disabled={filtered.length === 0}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">原文</th>
              <th className="px-3 py-2 text-left font-medium">译文</th>
              <th className="px-3 py-2 text-left font-medium">类型</th>
              <th className="px-3 py-2 text-left font-medium">目标语言</th>
              <th className="px-3 py-2 text-right font-medium">命中次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                </td>
                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{m.sourceText}</td>
                <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">{m.targetText}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500">{PACKAGE_LABEL[m.packageType]}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500">
                  {m.targetCode ? targetLanguageName(m.targetCode) : '（旧数据）'}
                </td>
                <td className="px-3 py-1.5 text-right text-xs text-slate-500">{m.hitCount}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  暂无翻译记忆，完成翻译后会自动积累
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
