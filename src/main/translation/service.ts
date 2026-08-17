import type { EntryStatus, GlossaryEntry, LLMConfig, PackageType, TranslationEntry, TranslationIssue } from '@shared/types'
import * as db from '../db/database'
import { llmChat } from '../llm/provider'
import { buildSystemPrompt, buildGlossaryBlock, buildUserMessage } from '../llm/prompts'
import { parseTranslations } from '../llm/json-repair'
import { validateAll } from './validate'
import { RateLimiter, Semaphore, withRetry } from './rate'
import { logger } from '../logger'

interface ActiveTask {
  taskId: string
  projectId: string
  cancel: boolean
  pause: boolean
  pauseWaiters: (() => void)[]
}

const active = new Map<string, ActiveTask>()

export interface TranslateOptions {
  reTranslate?: boolean
  onlySelected?: boolean
  scope?: 'all' | 'selected'
}

export interface TranslateResult {
  ok: boolean
  translated: number
  reused: number
  failed: number
  cancelled: boolean
  error?: string
}

export type ProgressCallback = (p: {
  taskId: string
  status: string
  done: number
  total: number
  failed: number
  progress: number
}) => void

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function checkPause(task: ActiveTask): Promise<void> {
  while (task.pause && !task.cancel) {
    await new Promise<void>((resolve) => task.pauseWaiters.push(resolve))
  }
}

export function pauseTask(taskId: string): void {
  const t = active.get(taskId)
  if (t) {
    t.pause = true
    db.updateTask(taskId, { status: 'paused' })
    logger.info(`任务 ${taskId} 已暂停`)
  }
}

export function resumeTask(taskId: string): void {
  const t = active.get(taskId)
  if (t) {
    t.pause = false
    const waiters = t.pauseWaiters.splice(0)
    for (const w of waiters) w()
    db.updateTask(taskId, { status: 'running' })
    logger.info(`任务 ${taskId} 已继续`)
  }
}

export function cancelTask(taskId: string): void {
  const t = active.get(taskId)
  if (t) {
    t.cancel = true
    t.pause = false
    const waiters = t.pauseWaiters.splice(0)
    for (const w of waiters) w()
    logger.info(`任务 ${taskId} 已取消`)
  }
}

export async function translateProject(
  projectId: string,
  config: LLMConfig,
  options: TranslateOptions,
  onProgress?: ProgressCallback
): Promise<TranslateResult> {
  const allEntries = db.listEntries(projectId)
  const packages = db.listPackages(projectId)
  const glossary = db.listGlossary()

  // Entries eligible for translation
  const eligible = allEntries.filter((e) => {
    if (e.status === 'builtin') return false
    if (options.scope === 'selected' || options.onlySelected) {
      if (!e.selected) return false
    }
    if (!options.reTranslate && e.targetText && e.status !== 'failed' && e.status !== 'needs_review') {
      return false
    }
    return true
  })

  if (eligible.length === 0) {
    return { ok: true, translated: 0, reused: 0, failed: 0, cancelled: false }
  }

  const task = db.createTask(projectId, 'translate', eligible.length)
  const activeTask: ActiveTask = { taskId: task.id, projectId, cancel: false, pause: false, pauseWaiters: [] }
  active.set(task.id, activeTask)
  db.updateTask(task.id, { status: 'running' })

  let done = 0
  let failed = 0
  let reused = 0
  let translated = 0
  let cancelled = false

  const emit = (): void => {
    onProgress?.({
      taskId: task.id,
      status: activeTask.pause ? 'paused' : 'running',
      done,
      total: eligible.length,
      failed,
      progress: eligible.length > 0 ? Math.round((done / eligible.length) * 100) : 100
    })
    db.updateTask(task.id, {
      done,
      total: eligible.length,
      failed,
      progress: eligible.length > 0 ? done / eligible.length : 1
    })
  }

  const glossaryByType = (pkgType: PackageType): GlossaryEntry[] =>
    glossary.filter((g) => g.packageType === 'all' || g.packageType === pkgType)

  emit() // fire an initial progress event so the renderer learns the taskId immediately

  // exact-match map (source text -> target) for reuse — 只复用与当前目标语言一致的记忆
  const memoryMap = new Map<string, string>()
  for (const m of db.listMemory()) {
    if (m.targetCode === config.targetLanguage) memoryMap.set(m.sourceText, m.targetText)
  }
  const glossaryExact = new Map<string, string>()
  for (const g of glossary) glossaryExact.set(g.source, g.target)

  // partition: reuse via TM/glossary vs LLM batches
  const toReuse: TranslationEntry[] = []
  const toTranslate: TranslationEntry[] = []
  for (const e of eligible) {
    const mem = memoryMap.get(e.sourceText)
    if (mem) {
      toReuse.push(e)
      continue
    }
    const gl = glossaryExact.get(e.sourceText)
    if (gl) {
      toReuse.push(e)
      continue
    }
    toTranslate.push(e)
  }

  try {
    // Phase 1: reuse from TM / glossary
    for (const e of toReuse) {
      if (activeTask.cancel) break
      await checkPause(activeTask)
      const mem = memoryMap.get(e.sourceText)
      const gl = glossaryExact.get(e.sourceText)
      const val = mem ?? gl ?? ''
      const issues = validateAll(e.sourceText, val, glossaryByType(db.listPackages(projectId).find((p) => p.id === e.packageId)?.type ?? 'unknown'))
      const status = issues.some((i) => i.severity === 'error') ? 'needs_review' : 'ai_translated'
      db.updateEntryTarget(e.id, val, status)
      db.updateEntryIssues(e.id, issues, null)
      db.upsertMemory(e.sourceText, val, e.category, config.targetLanguage)
      db.addHistory(e.id, 'ai', val)
      reused++
      done++
      emit()
    }

    // Phase 2: LLM batch translation
    const limiter = new RateLimiter(config.requestInterval || 0)
    const semaphore = new Semaphore(config.concurrency || 1)
    const batches = chunk(toTranslate, Math.max(1, config.batchSize || 40))
    let cursor = 0

    const packageOf = (entry: TranslationEntry): { name: string; type: PackageType } => {
      const p = packages.find((x) => x.id === entry.packageId)
      return { name: p?.name ?? '', type: p?.type ?? 'unknown' }
    }

    const processBatch = async (batch: TranslationEntry[]): Promise<void> => {
      await checkPause(activeTask)
      if (activeTask.cancel) return
      await semaphore.acquire()
      try {
        await checkPause(activeTask)
        if (activeTask.cancel) return

        const first = batch[0]
        const { name, type } = packageOf(first)
        const sys = buildSystemPrompt(type, config.targetLanguage) + buildGlossaryBlock(glossaryByType(type))
        const user = buildUserMessage(batch, {
          packageName: name,
          category: first.category,
          packageType: type,
          targetLanguage: config.targetLanguage
        })

        const content = await withRetry(
          () => llmChat(config, [{ role: 'system', content: sys }, { role: 'user', content: user }]),
          {
            maxRetries: config.maxRetries ?? 3,
            baseDelayMs: 1000,
            onRetry: (attempt, err) => {
              logger.warn(`批次重试 ${attempt}: ${err}`)
            }
          }
        )

        const translations = parseTranslations(content)

        for (const entry of batch) {
          const t = translations[entry.key]
          if (t == null || t.trim() === '') {
            failed++
            db.updateEntryStatus(entry.id, 'failed')
            db.insertIssue(projectId, entry.id, 'missing', `AI 未返回 key "${entry.key}" 的译文`)
            continue
          }
          const issues = validateAll(entry.sourceText, t, glossaryByType(type))
          const hasError = issues.some((i) => i.severity === 'error')
          const status = hasError ? 'needs_review' : 'ai_translated'
          db.updateEntryTarget(entry.id, t, status)
          db.updateEntryIssues(entry.id, issues, null)
          db.upsertMemory(entry.sourceText, t, type, config.targetLanguage)
          db.addHistory(entry.id, 'ai', t)
          for (const issue of issues) {
            db.insertIssue(projectId, entry.id, issue.type, issue.message)
          }
          translated++
          done++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`批次翻译失败: ${msg}`)
        for (const entry of batch) {
          failed++
          done++
          db.updateEntryStatus(entry.id, 'failed')
          db.insertIssue(projectId, entry.id, 'failed', msg)
        }
      } finally {
        semaphore.release()
        emit()
      }
    }

    const workers = Array.from({ length: Math.max(1, config.concurrency || 1) }, async () => {
      while (!activeTask.cancel) {
        await checkPause(activeTask)
        if (activeTask.cancel) break
        const idx = cursor++
        if (idx >= batches.length) break
        await limiter.wait()
        await processBatch(batches[idx])
      }
    })

    await Promise.all(workers)

    if (activeTask.cancel) cancelled = true
  } catch (err) {
    logger.error(`翻译任务异常: ${err}`)
    db.updateTask(task.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
    active.delete(task.id)
    return { ok: false, translated, reused, failed, cancelled, error: err instanceof Error ? err.message : String(err) }
  }

  const finalStatus = cancelled ? 'cancelled' : failed > 0 && translated === 0 ? 'failed' : 'completed'
  db.updateTask(task.id, { status: finalStatus, done, total: eligible.length, failed })
  active.delete(task.id)
  logger.info(`翻译完成: 翻译 ${translated}, 复用 ${reused}, 失败 ${failed}`)
  return { ok: !cancelled, translated, reused, failed, cancelled }
}
