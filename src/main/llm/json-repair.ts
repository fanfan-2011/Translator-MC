import JSON5 from 'json5'

export interface LLMTranslations {
  translations?: Record<string, unknown>
}

export interface LLMReviewResults {
  results?: { key: string; score: number; issues: string[]; suggestion: string | null }[]
}

// Robustly parse an LLM response that may be wrapped in markdown fences or
// contain trailing commas / single quotes. Returns a plain object or throws.
export function parseLLMJson(content: string): unknown {
  let s = content.trim()
  s = s.replace(/^```(?:json|JSON)?\s*/i, '').replace(/```\s*$/, '').trim()

  try { return JSON.parse(s) } catch { /* fall through */ }

  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const candidate = s.slice(start, end + 1)
    try { return JSON.parse(candidate) } catch { /* fall through */ }
    try { return JSON5.parse(candidate) } catch { /* fall through */ }
  }
  throw new Error('无法解析 AI 返回的 JSON')
}

/**
 * Recursively walk a nested object/array tree and collect all leaf strings,
 * emitting paths relative to the starting node. String leafs at depth 0 are
 * emitted with key ''; deeper leafs get dot-joined paths.
 */
function collectLeavesFromNode(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (obj == null) return out
  if (typeof obj === 'string') {
    out.set(prefix, obj)
    return out
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const sub = collectLeavesFromNode(item, prefix ? `${prefix}.${i}` : String(i))
      sub.forEach((v, k) => out.set(k, v))
    })
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const sub = collectLeavesFromNode(v, prefix ? `${prefix}.${k}` : k)
      sub.forEach((vv, kk) => out.set(kk, vv))
    }
  }
  return out
}

/**
 * Resolve a translation value for `flatKey`.
 *
 * 1. Exact string match: translations[flatKey] is a string → return it.
 * 2. The value is an object/array → the LLM nested the key. Walk the nested
 *    subtree, then try each possible split of flatKey into prefix+suffix and
 *    look up suffix in the subtree's leaf map.
 */
function resolveValue(
  translations: Record<string, unknown>,
  flatKey: string
): string | undefined {
  const direct = translations[flatKey]
  if (typeof direct === 'string') return direct
  if (direct != null && typeof direct === 'object') {
    const subtree = collectLeavesFromNode(direct)
    const parts = flatKey.split('.')
    // Try splitting flatKey at every position: prefix + "." + suffix,
    // and check if suffix exists in the subtree.
    for (let i = 0; i <= parts.length; i++) {
      const suffix = parts.slice(i).join('.')
      if (subtree.has(suffix)) {
        const val = subtree.get(suffix)
        if (val != null) return val
      }
    }
  }
  return undefined
}

export function parseTranslations(
  content: string,
  requestedKeys?: Readonly<string[]>
): Record<string, string> {
  const obj = parseLLMJson(content) as LLMTranslations
  const translations = obj?.translations
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    throw new Error('AI 返回缺少 translations 字段')
  }

  if (requestedKeys && requestedKeys.length > 0) {
    const result: Record<string, string> = {}
    for (const k of requestedKeys) {
      const val = resolveValue(translations as Record<string, unknown>, k)
      if (val != null) result[k] = val
    }
    return result
  }

  // No requestedKeys: collect all leaf strings from the entire tree.
  const leafMap = collectLeavesFromNode(translations as Record<string, unknown>)
  const flat: Record<string, string> = {}
  leafMap.forEach((v, k) => { if (k !== '') flat[k] = v })
  return flat
}

export function parseReview(content: string): LLMReviewResults {
  const obj = parseLLMJson(content) as LLMReviewResults
  if (obj?.results && Array.isArray(obj.results)) {
    return obj
  }
  throw new Error('审校结果格式错误')
}
