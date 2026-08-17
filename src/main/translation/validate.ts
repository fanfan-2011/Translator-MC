import { extractPlaceholders } from '../parser'
import type { GlossaryEntry, TranslationIssue } from '@shared/types'

const FORMAT_RE = /§[0-9a-fk-or]/gi

function countTokens(text: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of extractPlaceholders(text)) {
    map.set(t, (map.get(t) ?? 0) + 1)
  }
  return map
}

export function validatePlaceholders(source: string, target: string): TranslationIssue[] {
  if (!target) return []
  const sc = countTokens(source)
  const tc = countTokens(target)
  const issues: TranslationIssue[] = []
  for (const [token, count] of sc) {
    const tcount = tc.get(token) ?? 0
    if (tcount < count) {
      issues.push({
        type: 'placeholder',
        severity: 'error',
        message: `占位符 ${token} 缺失（原文 ${count} 个，译文 ${tcount} 个）`
      })
    }
  }
  return issues
}

export function validateFormatCodes(source: string, target: string): TranslationIssue[] {
  if (!target) return []
  const sc = new Set((source.match(FORMAT_RE) ?? []).map((s) => s.toLowerCase()))
  const tc = new Set((target.match(FORMAT_RE) ?? []).map((s) => s.toLowerCase()))
  const issues: TranslationIssue[] = []
  for (const c of sc) {
    if (!tc.has(c)) {
      issues.push({ type: 'format_code', severity: 'warning', message: `格式代码 ${c} 在译文中丢失` })
    }
  }
  return issues
}

export function validateGlossary(source: string, target: string, glossary: GlossaryEntry[]): TranslationIssue[] {
  if (!target) return []
  const issues: TranslationIssue[] = []
  for (const g of glossary) {
    if (!g.source || !g.target) continue
    const needle = g.caseSensitive ? g.source : g.source.toLowerCase()
    const haystack = g.caseSensitive ? source : source.toLowerCase()
    if (haystack.includes(needle)) {
      const tNeedle = g.caseSensitive ? g.target : g.target.toLowerCase()
      const tHaystack = g.caseSensitive ? target : target.toLowerCase()
      if (!tHaystack.includes(tNeedle)) {
        issues.push({
          type: 'terminology',
          severity: 'warning',
          message: `术语 "${g.source}" 应译为 "${g.target}"`
        })
      }
    }
  }
  return issues
}

export function validateEmpty(target: string): TranslationIssue[] {
  if (!target || target.trim() === '') {
    return [{ type: 'empty', severity: 'error', message: '译文为空' }]
  }
  return []
}

export function validateAll(
  source: string,
  target: string,
  glossary: GlossaryEntry[]
): TranslationIssue[] {
  return [
    ...validateEmpty(target),
    ...validatePlaceholders(source, target),
    ...validateFormatCodes(source, target),
    ...validateGlossary(source, target, glossary)
  ]
}
