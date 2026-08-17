import { useEffect, useMemo, useState } from 'react'
import { Search, AlertTriangle, Check, Circle } from 'lucide-react'
import { TARGET_LANGUAGES, targetLanguageName, type EntryStatus, type TranslationEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { STATUS_LABEL } from '../../lib/status'
import { Button, ProgressBar, Select, Spinner } from '../ui'
import { TranslationTable } from './TranslationTable'

type StatusFilter = 'all' | EntryStatus | 'needs_attention'

export function TranslationWorkspace(): JSX.Element {
  const entries = useApp((s) => s.entries)
  const projectId = useApp((s) => s.currentProjectId)
  const task = useApp((s) => s.task)
  const setTask = useApp((s) => s.setTask)
  const setReviewing = useApp((s) => s.setReviewing)
  const reviewing = useApp((s) => s.reviewing)
  const toastMsg = useApp((s) => s.toastMsg)
  const loadProjectData = useApp((s) => s.loadProjectData)
  const llmConfig = useApp((s) => s.llmConfig)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const setExportOpen = useApp((s) => s.setExportOpen)
  const setImportOpen = useApp((s) => s.setImportOpen)
  const setIssueOpen = useApp((s) => s.setIssueOpen)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [qualityFilter, setQualityFilter] = useState<'all' | 'low'>('all')

  useEffect(() => {
    const off1 = api.onTranslateProgress((p) => setTask(p))
    const off2 = api.onTranslateDone(async (r) => {
      setTask(null)
      if (projectId) await loadProjectData(projectId)
      if (!r.ok) toastMsg(r.error ?? '翻译失败', 'error')
      else toastMsg(`翻译完成：${r.translated} 条，复用 ${r.reused} 条，失败 ${r.failed} 条`, 'success')
    })
    const off3 = api.onReviewProgress((p) => setReviewing(p))
    const off4 = api.onReviewDone(async (r) => {
      setReviewing(null)
      if (projectId) await loadProjectData(projectId)
      toastMsg(`审校完成：${r.reviewed} 条，需人工复核 ${r.needsReview} 条`, 'success')
    })
    return () => {
      off1()
      off2()
      off3()
      off4()
    }
  }, [projectId, setTask, setReviewing, loadProjectData, toastMsg])

  const filtered = useMemo(() => {
    let list = entries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          e.sourceText.toLowerCase().includes(q) ||
          (e.targetText ?? '').toLowerCase().includes(q) ||
          (e.note ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'needs_attention') {
      list = list.filter((e) => e.status === 'needs_review' || e.status === 'failed')
    } else if (statusFilter !== 'all') {
      list = list.filter((e) => e.status === statusFilter)
    }
    if (qualityFilter === 'low') {
      list = list.filter((e) => e.qualityScore != null && e.qualityScore < 70)
    }
    return list
  }, [entries, search, statusFilter, qualityFilter])

  const mutateEntry = (id: string, patch: Partial<TranslationEntry>): void => {
    useApp.setState({ entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  }

  const onToggleSelect = (id: string, selected: boolean): void => {
    mutateEntry(id, { selected })
    void api.setSelected(id, selected)
  }
  const onToggleSelectAll = (ids: string[], selected: boolean): void => {
    useApp.setState({ entries: entries.map((e) => (ids.includes(e.id) ? { ...e, selected } : e)) })
    void api.setSelectedMany(ids, selected)
  }
  const onEditTarget = (id: string, target: string): void => {
    const e = entries.find((x) => x.id === id)
    if (e && e.targetText === target) return
    mutateEntry(id, { targetText: target, status: 'human_reviewed' })
    void api.updateEntryTarget(id, target, 'human_reviewed')
  }

  const startTranslate = async (reTranslate: boolean): Promise<void> => {
    if (!projectId) return
    if (!llmConfig.endpoint || !llmConfig.model) {
      toastMsg('请先在「AI 设置」中配置 Endpoint、API Key 和模型', 'error')
      setSettingsOpen(true)
      return
    }
    setTask({ taskId: '', status: 'running', done: 0, total: 0, failed: 0, progress: 0 })
    await api.startTranslate(projectId, { scope: reTranslate ? 'all' : 'selected', reTranslate })
  }

  const startReview = async (): Promise<void> => {
    if (!projectId) return
    if (!llmConfig.endpoint || !llmConfig.model) {
      toastMsg('请先在「AI 设置」中配置模型', 'error')
      setSettingsOpen(true)
      return
    }
    setReviewing({ done: 0, total: 0 })
    await api.startReview(projectId)
  }

  const clearAll = (): void => {
    if (!projectId) return
    if (window.confirm('确定清除所有译文吗？（自带中文不会被清除）')) {
      void api.clearAllTargets(projectId).then(async () => {
        await loadProjectData(projectId)
        toastMsg('已清除译文', 'success')
      })
    }
  }

  const changeTargetLanguage = async (code: string): Promise<void> => {
    const next = { ...llmConfig, targetLanguage: code }
    useApp.setState({ llmConfig: next })
    await api.setLlmConfig(next)
    toastMsg(`目标语言：${targetLanguageName(code)}`, 'success')
  }

  const counts = useMemo(() => {
    const c = { total: entries.length, translated: 0, selected: 0, builtin: 0, needsReview: 0 }
    for (const e of entries) {
      if (e.targetText) c.translated++
      if (e.selected) c.selected++
      if (e.status === 'builtin') c.builtin++
      if (e.status === 'needs_review' || e.status === 'failed') c.needsReview++
    }
    return c
  }, [entries])

  const busy = !!task || !!reviewing

  return (
    <div className="flex h-full">
      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
          <span className="mr-1 text-sm text-slate-600 dark:text-slate-300">
            {counts.translated} / {counts.total} 已翻译
            {counts.builtin > 0 ? ` · 自带 ${counts.builtin}` : ''}
            {counts.needsReview > 0 ? ` · 待复核 ${counts.needsReview}` : ''}
          </span>
          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            目标语言
            <Select
              value={llmConfig.targetLanguage || 'zh_cn'}
              onChange={(v) => void changeTargetLanguage(v)}
              className="h-7 w-32 py-0 text-xs"
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </label>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void startTranslate(false)}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : null} AI 翻译
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void startTranslate(true)}>
            重新翻译
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void startReview()}>
            AI 审校
          </Button>
          <Button size="sm" disabled={busy} onClick={clearAll}>
            清除译文
          </Button>
          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <Button size="sm" onClick={() => setImportOpen(true)}>
            导入
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            导出
          </Button>
          <Button size="sm" onClick={() => setIssueOpen(true)}>
            <AlertTriangle className="h-3.5 w-3.5" /> 问题中心
          </Button>
        </div>

        {/* filter bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 key / 原文 / 译文 / 备注"
              className="h-8 w-72 rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">全部状态</option>
            <option value="pending">未翻译</option>
            <option value="ai_translated">AI 翻译</option>
            <option value="human_reviewed">人工确认</option>
            <option value="builtin">自带中文</option>
            <option value="needs_review">需审核</option>
            <option value="failed">失败</option>
            <option value="needs_attention">需要关注</option>
          </select>
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value as 'all' | 'low')}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">全部质量</option>
            <option value="low">质量 &lt; 70</option>
          </select>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} 条</span>
        </div>

        {/* table */}
        <div className="min-h-0 flex-1">
          <TranslationTable
            entries={filtered}
            handlers={{ onToggleSelect, onToggleSelectAll, onEditTarget, onClearTarget: () => {} }}
          />
        </div>
      </div>

      {/* agent panel */}
      {busy ? <AgentPanel /> : null}
    </div>
  )
}

function AgentPanel(): JSX.Element {
  const task = useApp((s) => s.task)
  const reviewing = useApp((s) => s.reviewing)
  const entries = useApp((s) => s.entries)

  const isReview = !!reviewing
  const total = isReview ? reviewing!.total || entries.filter((e) => e.targetText).length : task!.total
  const done = isReview ? reviewing!.done : task!.done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const status = isReview ? 'running' : task!.status

  const steps = [
    { label: '文件分析', done: true },
    { label: '术语提取', done: true },
    { label: isReview ? 'AI 质量审校' : 'AI 批量翻译', done: done > 0 },
    { label: '校验与检查', done: pct >= 100 }
  ]

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI Agent</div>
      <div className="mt-2 text-xs text-slate-500">{isReview ? '正在执行质量审校…' : '当前任务：批量翻译'}</div>

      <div className="mt-3">
        <ProgressBar value={pct} />
        <div className="mt-1.5 text-right text-xs text-slate-500">
          {status === 'paused' ? '已暂停' : `${pct}%`} · {done}/{total}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            {s.done ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            )}
            <span className={s.done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>{s.label}</span>
          </div>
        ))}
      </div>

      {task?.failed ? (
        <div className="mt-4 flex items-center gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {task.failed} 条失败
        </div>
      ) : null}

      {!isReview ? (
        <div className="mt-auto flex gap-2 pt-4">
          {task?.status === 'paused' ? (
            <Button size="sm" variant="primary" onClick={() => void api.resumeTranslate(task.taskId)}>
              继续
            </Button>
          ) : (
            <Button size="sm" onClick={() => void api.pauseTranslate(task!.taskId)}>
              暂停
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => void api.cancelTranslate(task!.taskId)}>
            取消
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
