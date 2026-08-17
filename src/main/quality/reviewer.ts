import type { LLMConfig, PackageType, TranslationEntry } from '@shared/types'
import { llmChat } from '../llm/provider'
import { buildReviewPrompt } from '../llm/prompts'
import { parseReview } from '../llm/json-repair'
import * as db from '../db/database'
import { logger } from '../logger'

export interface ReviewResult {
  reviewed: number
  needsReview: number
}

const REVIEW_THRESHOLD = 70

// Review already-translated entries with a second LLM pass.
export async function reviewProject(
  projectId: string,
  config: LLMConfig,
  onProgress?: (done: number, total: number) => void
): Promise<ReviewResult> {
  const entries = db.listEntries(projectId).filter((e) => e.targetText && e.targetText.trim() !== '')
  const packages = db.listPackages(projectId)
  const typeOf = (e: TranslationEntry): PackageType => packages.find((p) => p.id === e.packageId)?.type ?? 'unknown'

  const BATCH = Math.max(1, config.batchSize || 40)
  let done = 0
  let needsReview = 0

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    const pkgType = typeOf(batch[0])
    const prompt = buildReviewPrompt(
      batch.map((e) => ({ key: e.key, sourceText: e.sourceText, targetText: e.targetText })),
      pkgType,
      config.targetLanguage
    )
    try {
      const content = await llmChat(config, [
        { role: 'system', content: '你是一名翻译质量审校专家。' },
        { role: 'user', content: prompt }
      ])
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
        }
        done++
      }
    } catch (err) {
      logger.warn(`审校批次失败: ${err}`)
      done += batch.length
    }
    onProgress?.(done, entries.length)
  }

  return { reviewed: done, needsReview }
}
