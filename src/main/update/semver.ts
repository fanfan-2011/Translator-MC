/**
 * 版本号与 Release 文本的纯函数工具（无 IO，selftest 直接断言）。
 */

/** 去掉 tag 前缀 `v` 与首尾空白 */
export function normalizeVersion(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/^v/i, '')
}

/** 版本 → 数字分段（非数字后缀忽略：`2.0.0-beta` → [2,0,0]） */
export function parseVersion(input: string): number[] {
  return normalizeVersion(input)
    .split(/[.\-+_/]/)
    .map((seg) => {
      const m = /^\d+/.exec(seg.trim())
      return m ? parseInt(m[0], 10) : 0
    })
}

/** candidate 是否比 current 新（逐段比较，缺段按 0） */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** 从一组 tag 里挑版本最高的（忽略不像版本的字符串） */
export function pickLatest(tags: string[]): string | null {
  let best: string | null = null
  for (const t of tags) {
    if (!/^v?\d/.test(String(t ?? '').trim())) continue
    if (!best || isNewer(t, best)) best = t
  }
  return best
}

/** 比较两个版本，返回降序比较值（供 Array.sort 用） */
export function compareDesc(a: string, b: string): number {
  if (a === b) return 0
  return isNewer(a, b) ? -1 : 1
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

/** 解码 HTML 实体（含数字实体） */
export function decodeEntities(input: string): string {
  return String(input ?? '').replace(/&(#?[0-9a-zA-Z]+);/g, (m, name: string) => {
    const key = name.toLowerCase()
    if (ENTITIES[key] !== undefined) return ENTITIES[key]
    if (key.startsWith('#x')) {
      const n = parseInt(key.slice(2), 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    if (key.startsWith('#')) {
      const n = parseInt(key.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return m
  })
}

/**
 * Release 正文 → 纯文本（更新内容滚动区显示用）。
 * 注意顺序：**先解码实体再去标签** —— GitHub 的 atom 里正文是被转义的 HTML
 * （`&lt;p&gt;…`），反过来的话标签会以字面量留在文本里。
 */
export function htmlToText(html: string): string {
  const decoded = decodeEntities(String(html ?? ''))
  return decoded
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|tr|section|blockquote)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '· ')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
