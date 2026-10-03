import { useEffect, useState } from 'react'
import { Brain } from 'lucide-react'
import { targetLanguageName, type MemoryEntry } from '@shared/types'
import { api } from '../../api'
import { PACKAGE_LABEL } from '../../lib/status'
import { Checkbox, EmptyState } from '../ui'

/**
 * 危险操作按钮：UI-SPEC 6.6 规定危险操作只用 danger 令牌的描边/文字按钮，
 * 所以这里不用实心填充的 Button variant="danger"。
 */
const DANGER_BTN =
  'app-nodrag inline-flex h-[33px] shrink-0 items-center justify-center rounded-full border border-danger bg-surface px-3.5 text-base font-semibold text-danger transition-[background-color,opacity] hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50'

/**
 * 翻译记忆 —— 按 UI-SPEC 第 6 节的列表页模板：操作栏 h71（标题 + 共享说明 + 危险操作）
 * + 搜索栏 h57 + 表头 h41 / 行 h37（奇行 bg-alt，悬停 bg-hover，选中 bg-selected），
 * 空状态用 EmptyState。「删除选中」「清空全部」是跨项目全局共享数据的危险操作，
 * 二次确认弹窗与文案完全保持原样。
 */
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
    if (
      window.confirm(
        `确定清空全部 ${memory.length} 条翻译记忆吗？\n\n注意：翻译记忆为所有项目共享，此操作会一并清掉其它项目的记忆，且不可撤销。`
      )
    ) {
      await api.deleteMemoryMany([])
      reload()
    }
  }

  const allChecked = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 && !allChecked

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 操作栏：标题 + 共享说明 + 危险操作（删除选中 / 清空全部） */}
      <div className="flex h-[71px] shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="shrink-0 text-lg font-semibold text-ink">翻译记忆</h2>
          <span className="min-w-0 truncate-1 text-xs text-muted">
            翻译记忆会在后续翻译中自动复用完全相同的原文，共 {memory.length} 条（所有项目共享）。
          </span>
        </div>

        <div className="min-w-0 flex-1" />

        <button
          type="button"
          className={DANGER_BTN}
          disabled={selected.size === 0}
          onClick={() => void deleteSelected()}
        >
          删除选中{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
        <button
          type="button"
          className={DANGER_BTN}
          disabled={memory.length === 0}
          onClick={() => void clearAll()}
        >
          清空全部
        </button>
      </div>

      {/* 搜索栏 + 表格 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[57px] shrink-0 items-center gap-3 border-b border-line bg-surface-3 px-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索原文 / 译文…"
            className="h-8 w-[267px] shrink-0 rounded-input border border-line-2 bg-surface px-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
          <div className="min-w-0 flex-1" />
        </div>

        {filtered.length === 0 ? (
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={<Brain className="h-5 w-5" strokeWidth={1.7} />}
              title="暂无翻译记忆"
              description="完成翻译后会自动积累"
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* 表头 */}
            <div className="sticky top-0 z-10 flex h-[41px] items-center border-b border-line bg-surface-4 text-xs font-semibold text-muted-2">
              <div className="flex w-9 shrink-0 items-center justify-center">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someSelected}
                  title="全选"
                  onChange={toggleAll}
                />
              </div>
              <div className="w-[280px] shrink-0 pl-1">原文</div>
              <div className="min-w-0 flex-1 pl-1">译文</div>
              <div className="w-[96px] shrink-0 pl-1">类型</div>
              <div className="w-[120px] shrink-0 pl-1">目标语言</div>
              <div className="flex w-[88px] shrink-0 items-center justify-end pr-2">命中次数</div>
            </div>

            {filtered.map((m, i) => (
              <div
                key={m.id}
                className={`flex h-[37px] items-center border-b border-line-row ${
                  selected.has(m.id) ? 'bg-selected' : i % 2 === 1 ? 'bg-alt' : 'bg-surface'
                } hover:bg-hover`}
              >
                <div className="flex w-9 shrink-0 items-center justify-center">
                  <Checkbox checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                </div>
                <div
                  className="w-[280px] shrink-0 truncate-1 pl-1 pr-2 text-xs text-ink-4"
                  title={m.sourceText}
                >
                  {m.sourceText}
                </div>
                <div className="min-w-0 flex-1 truncate-1 pl-1 pr-2 text-xs text-target" title={m.targetText}>
                  {m.targetText}
                </div>
                <div className="w-[96px] shrink-0 pl-1 text-xs text-muted">
                  {PACKAGE_LABEL[m.packageType]}
                </div>
                <div className="w-[120px] shrink-0 pl-1 text-xs text-muted">
                  {m.targetCode ? targetLanguageName(m.targetCode) : '（旧数据）'}
                </div>
                <div className="flex w-[88px] shrink-0 items-center justify-end pr-2">
                  <span className="font-machine text-xs text-muted">{m.hitCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
