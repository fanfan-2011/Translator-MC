import { useEffect, useState } from 'react'
import type { GlossaryEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Input, Select, Checkbox } from '../ui'
import { PACKAGE_LABEL } from '../../lib/status'

export function GlossaryPanel(): JSX.Element {
  const glossary = useApp((s) => s.glossary)
  const loadGlossary = useApp((s) => s.loadGlossary)
  const toastMsg = useApp((s) => s.toastMsg)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ source: '', target: '', packageType: 'all' as GlossaryEntry['packageType'], caseSensitive: false, note: '' })

  useEffect(() => {
    void loadGlossary()
  }, [loadGlossary])

  const filtered = glossary.filter(
    (g) =>
      !search ||
      g.source.toLowerCase().includes(search.toLowerCase()) ||
      g.target.toLowerCase().includes(search.toLowerCase())
  )

  const add = async (): Promise<void> => {
    if (!form.source.trim() || !form.target.trim()) return
    await api.addGlossary(form)
    setForm({ source: '', target: '', packageType: 'all', caseSensitive: false, note: '' })
    await loadGlossary()
    toastMsg('已添加术语', 'success')
  }

  const del = async (id: string): Promise<void> => {
    await api.deleteGlossary(id)
    await loadGlossary()
  }

  const toggleCase = async (g: GlossaryEntry): Promise<void> => {
    await api.updateGlossary(g.id, { caseSensitive: !g.caseSensitive })
    await loadGlossary()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">术语表</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索术语…"
          className="h-8 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex w-40 flex-col gap-1">
          <span className="text-xs text-slate-500">原文</span>
          <Input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="Diamond"
          />
        </div>
        <div className="flex w-40 flex-col gap-1">
          <span className="text-xs text-slate-500">译文</span>
          <Input
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder="钻石"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">适用范围</span>
          <Select
            value={form.packageType}
            onChange={(v) => setForm({ ...form, packageType: v as GlossaryEntry['packageType'] })}
          >
            <option value="all">全部</option>
            <option value="mod">Mod</option>
            <option value="shader">光影包</option>
            <option value="resourcepack">资源包</option>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm text-slate-600">
          <Checkbox
            checked={form.caseSensitive}
            onChange={(v) => setForm({ ...form, caseSensitive: v })}
          />
          区分大小写
        </label>
        <Button variant="primary" onClick={() => void add()}>
          添加
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium">原文</th>
              <th className="px-3 py-2 text-left font-medium">译文</th>
              <th className="px-3 py-2 text-left font-medium">适用范围</th>
              <th className="px-3 py-2 text-left font-medium">大小写</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-200">{g.source}</td>
                <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">{g.target}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500">{PACKAGE_LABEL[g.packageType]}</td>
                <td className="px-3 py-1.5 text-xs text-slate-500">
                  <button onClick={() => void toggleCase(g)} className="hover:underline">
                    {g.caseSensitive ? '是' : '否'}
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => void del(g.id)} className="text-xs text-red-500 hover:underline">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  还没有术语，添加「Diamond → 钻石」这样的映射
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
