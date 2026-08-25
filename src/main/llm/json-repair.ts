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

// Recursively flatten an object into dot-path keys. The LLM sometimes nests a
// flat key like "value.info0.0" as {value:{info0:{"0":"..."}}} (especially when
// the key contains dots and a trailing numeric segment). Flattening lets the
// caller still match it back to the original flat key via translations[key].
function flattenTranslations(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined) continue
    if (typeof v === 'string') {
      out[key] = v
    } else if (Array.isArray(v)) {
      // treat array indices as path segments (e.g. "0")
      v.forEach((item, i) => {
        if (typeof item === 'string') out[`${key}.${i}`] = item
        else if (item && typeof item === 'object') Object.assign(out, flattenTranslations(item as Record<string, unknown>, `${key}.${i}`))
      })
    } else if (typeof v === 'object') {
      Object.assign(out, flattenTranslations(v as Record<string, unknown>, key))
    }
    // numbers/booleans are not valid translations — skip to keep Record<string,string>
  }
  return out
}

export function parseTranslations(content: string): Record<string, string> {
  const obj = parseLLMJson(content) as LLMTranslations
  const translations = obj?.translations
  if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
    // If any value is itself an object, the LLM nested dot-path keys — flatten them.
    const hasNested = Object.values(translations as Record<string, unknown>).some(
      (v) => v !== null && typeof v === 'object'
    )
    if (hasNested) return flattenTranslations(translations as Record<string, unknown>)
    return translations as Record<string, string>
  }
  // Some models return a flat map directly
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const flat: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string') flat[k] = v
      else if (v && typeof v === 'object') Object.assign(flat, flattenTranslations(v as Record<string, unknown>, k))
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
