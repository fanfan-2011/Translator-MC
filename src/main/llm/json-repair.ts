import JSON5 from 'json5'

export interface LLMTranslations {
  translations?: Record<string, string>
}

export interface LLMReviewResults {
  results?: { key: string; score: number; issues: string[]; suggestion: string | null }[]
}

// Robustly parse an LLM response that may be wrapped in markdown fences or
// contain trailing commas / single quotes. Returns a plain object or throws.
export function parseLLMJson(content: string): unknown {
  let s = content.trim()
  // strip markdown code fences
  s = s.replace(/^```(?:json|JSON)?\s*/i, '').replace(/```\s*$/, '').trim()

  try {
    return JSON.parse(s)
  } catch {
    /* fall through */
  }

  // try to extract the outermost JSON object
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const candidate = s.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch {
      /* fall through */
    }
    try {
      return JSON5.parse(candidate)
    } catch {
      /* fall through */
    }
  }
  throw new Error('无法解析 AI 返回的 JSON')
}

export function parseTranslations(content: string): Record<string, string> {
  const obj = parseLLMJson(content) as LLMTranslations
  const translations = obj?.translations
  if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
    return translations as Record<string, string>
  }
  // Some models return a flat map directly
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const flat: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') flat[k] = v
    }
    if (Object.keys(flat).length > 0) return flat
  }
  throw new Error('AI 返回缺少 translations 字段')
}

export function parseReview(content: string): LLMReviewResults {
  const obj = parseLLMJson(content) as LLMReviewResults
  if (obj?.results && Array.isArray(obj.results)) {
    return obj
  }
  throw new Error('审校结果格式错误')
}
