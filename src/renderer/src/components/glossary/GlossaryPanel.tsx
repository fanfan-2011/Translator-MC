import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { GlossaryEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Checkbox, EmptyState, Input, Select } from '../ui'
import { PACKAGE_LABEL } from '../../lib/status'

/**
 * 术语表 —— 设计稿未覆盖，按 UI-SPEC 第 6 节的列表页模板推导：
 * 操作栏（h71 / bg-surface-2 / 圆角 18）承载标题与新增术语表单（主操作「添加」），
 * 搜索栏（h57 / bg-surface-3）承载搜索框与「共 N 条」，
 * 表头 h41 / 行 h37（奇行 bg-alt，悬停 bg-hover），空状态用 EmptyState。
 * 术语表为所有项目共享；单条删除沿用原有语义（不弹确认，用危险色文字按钮）。
 */
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
    <div className="flex h-full min-h-0 flex-col">
      {/* 操作栏：标题 + 新增术语（原文 / 译文 / 适用范围 / 区分大小写）+ 主操作「添加」 */}
      <div className="flex h-[71px] shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
        <h2 className="shrink-0 text-lg font-semibold text-ink">术语表</h2>

        <div className="h-7 w-px shrink-0 rounded-full bg-line" />

        <div className="flex shrink-0 items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted">原文</span>
          {/* Input 自带 w-full，宽度由外层容器给定 */}
          <div className="w-40 shrink-0">
            <Input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Diamond"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted">译文</span>
          <div className="w-40 shrink-0">
            <Input
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder="钻石"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="shrink-0 text-sm font-medium text-muted">适用范围</span>
          <Select
            value={form.packageType}
            className="w-28"
            onChange={(v) => setForm({ ...form, packageType: v as GlossaryEntry['packageType'] })}
          >
            <option value="all">全部</option>
            <option value="mod">Mod</option>
            <option value="shader">光影包</option>
            <option value="resourcepack">资源包</option>
          </Select>
        </div>

        <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-3">
          <Checkbox
            checked={form.caseSensitive}
            onChange={(v) => setForm({ ...form, caseSensitive: v })}
          />
          区分大小写
        </label>

        <Button variant="primary" onClick={() => void add()}>
          添加
        </Button>

        <div className="min-w-0 flex-1" />
      </div>

      {/* 搜索栏 + 表格 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[57px] shrink-0 items-center gap-3 border-b border-line bg-surface-3 px-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索术语…"
            className="h-8 w-[267px] shrink-0 rounded-input border border-line-2 bg-surface px-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
          <div className="min-w-0 flex-1" />
          <span className="shrink-0 text-sm text-muted-3">
            共 {filtered.length === glossary.length ? glossary.length : `${filtered.length} / ${glossary.length}`} 条
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={<BookOpen className="h-5 w-5" strokeWidth={1.7} />}
              title="还没有术语"
              description="添加「Diamond → 钻石」这样的映射"
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* 表头 */}
            <div className="sticky top-0 z-10 flex h-[41px] items-center border-b border-line bg-surface-4 text-xs font-semibold text-muted-2">
              <div className="w-[280px] shrink-0 pl-1">原文</div>
              <div className="min-w-0 flex-1 pl-1">译文</div>
              <div className="w-[120px] shrink-0 pl-1">适用范围</div>
              <div className="w-[96px] shrink-0 pl-1">大小写</div>
              <div className="flex w-[88px] shrink-0 items-center justify-end pr-1">操作</div>
            </div>

            {filtered.map((g, i) => (
              <div
                key={g.id}
                className={`flex h-[37px] items-center border-b border-line-row ${
                  i % 2 === 1 ? 'bg-alt' : 'bg-surface'
                } hover:bg-hover`}
              >
                <div
                  className="w-[280px] shrink-0 truncate-1 pl-1 pr-2 font-mono text-xs text-ink-4"
                  title={g.source}
                >
                  {g.source}
                </div>
                <div className="min-w-0 flex-1 truncate-1 pl-1 pr-2 text-xs text-target" title={g.target}>
                  {g.target}
                </div>
                <div className="w-[120px] shrink-0 pl-1 text-xs text-muted">
                  {PACKAGE_LABEL[g.packageType]}
                </div>
                <div className="w-[96px] shrink-0 pl-1">
                  <button
                    type="button"
                    title="切换区分大小写"
                    onClick={() => void toggleCase(g)}
                    className="app-nodrag rounded-chip px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink"
                  >
                    {g.caseSensitive ? '是' : '否'}
                  </button>
                </div>
                <div className="flex w-[88px] shrink-0 items-center justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => void del(g.id)}
                    className="app-nodrag rounded-chip px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
