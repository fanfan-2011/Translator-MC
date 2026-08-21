import type { LLMConfig, PackageType, TranslationEntry } from '@shared/types'
import { llmChat } from '../llm/provider'
import { buildReviewPrompt } from '../llm/prompts'
import { parseReview } from '../llm/json-repair'
import * as db from '../db/database'
import { logger } from '../logger'
import { RateLimiter, Semaphore, withRetry } from '../translation/rate'
import { registerTaskController, unregisterTaskController, TaskController } from '../translation/task-control'

export interface ReviewResult {
  ok: boolean
  reviewed: number
  needsReview: number
  failed: number
  cancelled: boolean
  error?: string
}

export type ReviewProgress = {
  taskId: string
  status: string
  done: number
  total: number
  failed: number
}

export type ReviewProgressCallback = (p: ReviewProgress) => void

const REVIEW_THRESHOLD = 70

// Group entries so every LLM batch is homogeneous in package type (avoids
// mis-typed prompts when a batch spans mod + shader + resourcepack entries).
function groupByPackageType(
  entries: TranslationEntry[],
  typeOf: (e: TranslationEntry) => PackageType
): Map<PackageType, TranslationEntry[]> {
  const groups = new Map<PackageType, TranslationEntry[]>()
  for (const e of entries) {
    const t = typeOf(e)
    const arr = groups.get(t) ?? []
    arr.push(e)
    groups.set(t, arr)
  }
  return groups
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Review already-translated entries with a second LLM pass.
// Now supports pause / resume / cancel, concurrency, rate limiting and retry,
// and reports failed / missing results honestly.
export async function reviewProject(
  projectId: string,
  config: LLMConfig,
  onProgress?: ReviewProgressCallback
): Promise<ReviewResult> {
  const allEntries = db.listEntries(projectId).filter((e) => e.targetText && e.targetText.trim() !== '')
  const packages = db.listPackages(projectId)
  const typeOf = (e: TranslationEntry): PackageType => packages.find((p) => p.id === e.packageId)?.type ?? 'unknown'

  const groups = groupByPackageType(allEntries, typeOf)
  const all: TranslationEntry[] = []
  for (const arr of groups.values()) all.push(...arr)
  const total = all.length

  if (total === 0) {
    return { ok: true, reviewed: 0, needsReview: 0, failed: 0, cancelled: false }
  }

  const task = db.createTask(projectId, 'review', total)
  const controller: TaskController = new TaskController({
    taskId: task.id,
    onStateChange: (status) => db.updateTask(task.id, { status })
  })
  registerTaskController(controller)
  db.updateTask(task.id, { status: 'running' })

  let done = 0
  let failed = 0
  let needsReview = 0
  let cancelled = false

  const emit = (): void => {
    onProgress?.({
      taskId: task.id,
      status: controller.paused ? 'paused' : 'running',
      done,
      total,
      failed
    })
    db.updateTask(task.id, {
      done,
      total,
      failed,
      progress: total > 0 ? done / total : 1,
      status: controller.paused ? 'paused' : 'running'
    })
  }

  const BATCH = Math.max(1, config.batchSize || 40)
  const limiter = new RateLimiter(config.requestInterval || 0)
  const semaphore = new Semaphore(config.concurrency || 1)

  const processBatch = async (batch: TranslationEntry[]): Promise<void> => {
    await controller.checkPause()
    if (controller.cancelled) return
    await semaphore.acquire()
    try {
      await controller.checkPause()
      if (controller.cancelled) return

      const type = typeOf(batch[0])
      const prompt = buildReviewPrompt(
        batch.map((e) => ({ key: e.key, sourceText: e.sourceText, targetText: e.targetText })),
        type,
        config.targetLanguage
      )

      const content = await withRetry(
        () =>
          llmChat(config, [
            { role: 'system', content: '你是一名翻译质量审校专家。' },
            { role: 'user', content: prompt }
          ]),
        {
          maxRetries: config.maxRetries ?? 3,
          baseDelayMs: 1000,
          onRetry: (attempt, err) => {
            logger.warn(`审校批次重试 ${attempt}: ${err}`)
          }
        }
      )

      const parsed = parseReview(content)
      const byKey = new Map((parsed.results ?? []).map((r) => [r.key, r]))
      for (const e of batch) {
        const r = byKey.get(e.key)
        if (r) {
          const score = typeof r.score === 'number' ? r.score : null
          const issues = (r.issues ?? []).map((msg) => ({
            type: 'quality' as const,
            severity: 'warning' as const,
            message: msg
          }))
          db.updateEntryIssues(e.id, issues, score)
          if (score !== null && score < REVIEW_THRESHOLD) {
            db.updateEntryStatus(e.id, 'needs_review')
            needsReview++
          } else if (e.status === 'needs_review' && score !== null && score >= REVIEW_THRESHOLD) {
            db.updateEntryStatus(e.id, 'ai_translated')
          }
          db.addHistory(e.id, 'ai_review', e.targetText)
        } else {
          // LLM did not return a review for this key — count it as failed.
          failed++
          db.insertIssue(projectId, e.id, 'missing', `审校未返回 key "${e.key}" 的评分`)
        }
        done++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn(`审校批次失败: ${msg}`)
      for (const e of batch) {
        failed++
        done++
        db.insertIssue(projectId, e.id, 'quality', `审校失败: ${msg}`)
      }
    } finally {
      semaphore.release()
      emit()
    }
  }

  try {
    // Build a flat ordered batch list (homogeneous groups chunked together).
    const batches: TranslationEntry[][] = []
    let cursor = 0
    for (const arr of groups.values()) {
      for (const b of chunk(arr, BATCH)) batches.push(b)
    }
    const nextCursor = (): number => {
      const i = cursor++
      return i < batches.length ? i : -1
    }

    const workers = Array.from({ length: Math.max(1, config.concurrency || 1) }, async () => {
      while (!controller.cancelled) {
        await controller.checkPause()
        if (controller.cancelled) break
        const idx = nextCursor()
        if (idx < 0) break
        await limiter.wait()
        await processBatch(batches[idx])
      }
    })

    await Promise.all(workers)

    if (controller.cancelled) cancelled = true
  } catch (err) {
    logger.error(`审校任务异常: ${err}`)
    db.updateTask(task.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
    unregisterTaskController(task.id)
    return { ok: false, reviewed: done, needsReview, failed, cancelled, error: err instanceof Error ? err.message : String(err) }
  }

  const finalStatus = cancelled ? 'cancelled' : 'completed'
  db.updateTask(task.id, { status: finalStatus, done, total, failed })
  unregisterTaskController(task.id)
  logger.info(`审校完成: 审校 ${done}, 需人工复核 ${needsReview}, 失败 ${failed}`)
  return { ok: !cancelled, reviewed: done, needsReview, failed, cancelled }
}
