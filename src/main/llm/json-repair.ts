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
 * 在一个叶子表里按 flatKey 查找：先精确匹配，再尝试把 flatKey 的所有后缀当作叶子路径
 * （模型可能把点号 key 的某一层也展开了）。
 */
function matchLeaf(subtree: Map<string, string>, flatKey: string): string | undefined {
  const parts = flatKey.split('.')
  for (let i = 0; i <= parts.length; i++) {
    const suffix = parts.slice(i).join('.')
    if (suffix && subtree.has(suffix)) {
      const val = subtree.get(suffix)
      if (val != null) return val
    }
  }
  return undefined
}

/**
 * Resolve a translation value for `flatKey`.
 *
 * 1. Exact string match: translations[flatKey] is a string → return it.
 * 2. translations[flatKey] 是对象/数组（模型把 key 的值当成结构）→ 在其子树里按后缀查。
 * 3. 顶层就被拆成嵌套结构：`{"value.info0.0":"..."}` 被模型写成
 *    `{"value":{"info0":{"0":"..."}}}` → 沿 flatKey 的分段逐级下钻，
 *    在命中的子树上用剩余后缀查找（只沿 key 自己的路径走，不会串到别的分支）。
 */
function resolveValue(
  translations: Record<string, unknown>,
  flatKey: string
): string | undefined {
  const direct = translations[flatKey]
  if (typeof direct === 'string') return direct
  if (direct != null && typeof direct === 'object') {
    const hit = matchLeaf(collectLeavesFromNode(direct), flatKey)
    if (hit != null) return hit
  }

  const parts = flatKey.split('.')
  let node: unknown = translations
  for (let i = 1; i < parts.length; i++) {
    const cur = node as Record<string, unknown> | undefined
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined
    const seg = parts[i - 1]
    if (!(seg in cur)) return undefined
    node = cur[seg]
    const rest = parts.slice(i).join('.')
    if (typeof node === 'string') return rest === '' ? node : undefined
    if (node && typeof node === 'object') {
      const hit = matchLeaf(collectLeavesFromNode(node), rest)
      if (hit != null) return hit
    }
  }
  return undefined
}

export function parseTranslations(
  content: string,
  requestedKeys?: Readonly<string[]>
): Record<string, string> {
  const obj = parseLLMJson(content)
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('AI 返回缺少 translations 字段')
  }
  const root = obj as Record<string, unknown>
  // 可接受两种返回形态：
  // 1) { "translations": { "key": "译文" } } —— 提示词要求的格式
  // 2) 直接返回扁平 map { "key": "译文" } —— 部分模型会这样回，早期版本可解析，
  //    v1.7.1 重写解析器时丢了这条兼容路径（整批会被判失败）
  const wrapped = root.translations
  let translations: Record<string, unknown>
  if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
    translations = wrapped as Record<string, unknown>
  } else if ('translations' in root) {
    throw new Error('AI 返回缺少 translations 字段')
  } else {
    translations = root
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
