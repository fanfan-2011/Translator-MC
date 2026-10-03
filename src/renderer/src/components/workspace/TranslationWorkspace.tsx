import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Circle } from 'lucide-react'
import type { TranslationEntry } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button, EmptyState, ProgressBar } from '../ui'
import { TranslationTable } from './TranslationTable'
import { WorkspaceFilters, type QualityFilter, type StatusFilter } from './WorkspaceFilters'
import { WorkspaceToolbar } from './WorkspaceToolbar'

/**
 * 翻译页 —— 设计稿 6:5 的主体：操作栏（19:4）+ 搜索栏（45:2）+ 表格（45:14 / 45:27…）。
 * 进度看板（AgentPanel）是设计稿没有画的部分，按 UI-SPEC 第 6 节的推导规则
 * 用同一套令牌实现，仅在任务运行时出现。
 */
export function TranslationWorkspace(): JSX.Element {
  const entries = useApp((s) => s.entries)
  const projectId = useApp((s) => s.currentProjectId)
  const task = useApp((s) => s.task)
  const setTask = useApp((s) => s.setTask)
  const reviewing = useApp((s) => s.reviewing)
  const setReviewing = useApp((s) => s.setReviewing)
  const toastMsg = useApp((s) => s.toastMsg)
  const loadProjectData = useApp((s) => s.loadProjectData)
  const llmConfig = useApp((s) => s.llmConfig)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')

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
      if (!r.ok) {
        toastMsg(r.error ?? '审校失败', 'error')
      } else if (r.cancelled) {
        toastMsg(`审校已取消：审校 ${r.reviewed} 条，失败 ${r.failed} 条`, 'info')
      } else {
        toastMsg(`审校完成：审校 ${r.reviewed} 条，需人工复核 ${r.needsReview} 条，失败 ${r.failed} 条`, 'success')
      }
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
      list = list.filter((e) => e.status === 'needs_review' || e.status === 'failed' || e.issues.length > 0)
    } else if (statusFilter !== 'all') {
      list = list.filter((e) => e.status === statusFilter)
    }
    if (qualityFilter === 'low') {
      list = list.filter((e) => e.qualityScore != null && e.qualityScore < 70)
    } else if (qualityFilter === 'scored') {
      list = list.filter((e) => e.qualityScore != null)
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
  const onClearTarget = (id: string): void => {
    mutateEntry(id, { targetText: '', status: 'pending', qualityScore: null, issues: [] })
    void api.clearTarget(id)
  }

  const ensureAiReady = (): boolean => {
    if (!llmConfig.endpoint || !llmConfig.model) {
      toastMsg('请先在「设置」中配置 Endpoint、API Key 和模型', 'error')
      setSettingsOpen(true)
      return false
    }
    return true
  }

  const startTranslate = async (reTranslate: boolean): Promise<void> => {
    if (!projectId || !ensureAiReady()) return
    setTask({ taskId: '', status: 'running', done: 0, total: 0, failed: 0, progress: 0 })
    await api.startTranslate(projectId, { scope: reTranslate ? 'all' : 'selected', reTranslate })
  }

  const startReview = async (): Promise<void> => {
    if (!projectId || !ensureAiReady()) return
    setReviewing({ taskId: '', status: 'running', done: 0, total: 0, failed: 0 })
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

  const busy = !!task || !!reviewing

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceToolbar
          busy={busy}
          onTranslate={() => void startTranslate(false)}
          onRetranslate={() => void startTranslate(true)}
          onReview={() => void startReview()}
          onClear={clearAll}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
          <WorkspaceFilters
            search={search}
            onSearch={setSearch}
            status={statusFilter}
            onStatus={setStatusFilter}
            quality={qualityFilter}
            onQuality={setQualityFilter}
            total={entries.length}
            shown={filtered.length}
          />
          <div className="min-h-0 flex-1">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-6 w-6" strokeWidth={1.7} />}
                title={entries.length === 0 ? '这个项目还没有可翻译的条目' : '没有符合筛选条件的条目'}
                description={
                  entries.length === 0
                    ? '在左侧 mod 信息卡里切换项目，或拖入 Mod / 资源包 / 光影包开始导入。'
                    : '换个关键词，或把「全部状态 / 全部质量」调回默认。'
                }
              />
            ) : (
              <TranslationTable
                entries={filtered}
                handlers={{ onToggleSelect, onToggleSelectAll, onEditTarget, onClearTarget }}
              />
            )}
          </div>
        </div>
      </div>

      {busy ? <AgentPanel /> : null}
    </div>
  )
}

/** 任务进度看板（设计稿未覆盖，按同一套令牌推导） */
function AgentPanel(): JSX.Element {
  const task = useApp((s) => s.task)
  const reviewing = useApp((s) => s.reviewing)
  const entries = useApp((s) => s.entries)

  const isReview = !!reviewing
  const total = isReview ? reviewing!.total || entries.filter((e) => e.targetText).length : task!.total
  const done = isReview ? reviewing!.done : task!.done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const status = isReview ? reviewing!.status : task!.status

  const steps = [
    { label: '文件分析', done: true },
    { label: '术语提取', done: true },
    { label: isReview ? 'AI 质量审校' : 'AI 批量翻译', done: done > 0 },
    { label: '校验与检查', done: pct >= 100 }
  ]

  return (
    <aside className="m-3 flex w-64 shrink-0 flex-col rounded-panel border border-line bg-surface p-4 shadow-card">
      <div className="text-lg font-semibold text-ink">AI Agent</div>
      <div className="mt-1 text-xs text-muted">{isReview ? '正在执行质量审校…' : '当前任务：批量翻译'}</div>

      <div className="mt-4">
        <ProgressBar value={pct} />
        <div className="mt-2 text-right text-xs text-muted">
          {status === 'paused' ? '已暂停' : `${pct}%`} · {done}/{total}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            {s.done ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary-ink" strokeWidth={2.5} />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-4" strokeWidth={2} />
            )}
            <span className={s.done ? 'text-ink-3' : 'text-muted-4'}>{s.label}</span>
          </div>
        ))}
      </div>

      {task?.failed ? (
        <div className="mt-4 flex items-center gap-1.5 rounded-sm bg-[var(--tsm-st-attention-bg)] p-2 text-xs text-[var(--tsm-st-attention-fg)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {task.failed} 条失败
        </div>
      ) : null}

      {isReview && reviewing!.failed ? (
        <div className="mt-4 flex items-center gap-1.5 rounded-sm bg-[var(--tsm-st-attention-bg)] p-2 text-xs text-[var(--tsm-st-attention-fg)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          {reviewing!.failed} 条审校失败
        </div>
      ) : null}

      <div className="mt-auto flex gap-2 pt-4">
        {isReview ? (
          <>
            {reviewing!.status === 'paused' ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => void api.resumeReview(reviewing!.taskId)}
              >
                继续
              </Button>
            ) : (
              <Button size="sm" onClick={() => void api.pauseReview(reviewing!.taskId)}>
                暂停
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => void api.cancelReview(reviewing!.taskId)}>
              取消
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  )
}
