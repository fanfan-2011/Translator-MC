import type { EntryStatus, PackageType } from '@shared/types'

/** 条目状态文案（设计稿第 3.9 节 + 引擎已有状态全集） */
export const STATUS_LABEL: Record<EntryStatus, string> = {
  pending: '未翻译',
  translating: '翻译中',
  ai_translated: 'AI 翻译',
  human_reviewed: '人工确认',
  builtin: '自带翻译',
  skipped: '已跳过',
  failed: '失败',
  needs_review: '需审核'
}

/**
 * 状态徽章配色：底色/文字色来自 Figma 实测值，统一由 index.css 的
 * --tsm-st-* 变量给出（亮暗两套），这里只做状态 → 变量的映射。
 */
export const STATUS_BADGE: Record<EntryStatus, string> = {
  pending: 'bg-[var(--tsm-st-pending-bg)] text-[var(--tsm-st-pending-fg)]',
  translating: 'bg-[var(--tsm-st-ai-bg)] text-[var(--tsm-st-ai-fg)]',
  ai_translated: 'bg-[var(--tsm-st-ai-bg)] text-[var(--tsm-st-ai-fg)]',
  human_reviewed: 'bg-[var(--tsm-st-human-bg)] text-[var(--tsm-st-human-fg)]',
  builtin: 'bg-[var(--tsm-st-builtin-bg)] text-[var(--tsm-st-builtin-fg)]',
  skipped: 'bg-[var(--tsm-st-pending-bg)] text-[var(--tsm-muted-4)]',
  failed: 'bg-[var(--tsm-st-failed-bg)] text-[var(--tsm-st-failed-fg)]',
  needs_review: 'bg-[var(--tsm-st-review-bg)] text-[var(--tsm-st-review-fg)]'
}

/** 「需要关注」= 有问题记录或需要复核，设计稿里是一个独立的橙色徽章 */
export const ATTENTION_BADGE = 'bg-[var(--tsm-st-attention-bg)] text-[var(--tsm-st-attention-fg)]'

export const PACKAGE_LABEL: Record<PackageType | 'all', string> = {
  mod: 'Mod',
  shader: '光影包',
  resourcepack: '资源包',
  unknown: '未知',
  all: '全部'
}

export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * 展示用版本号：把未展开的构建占位符（如 `mods.toml` 里的 `${file.jarVersion}`）
 * 当作「无版本」处理，返回空串由调用方隐藏该字段。
 * 这样历史库里已经存进去的脏值也不会在界面上露出来，无需重新导入。
 */
export function displayVersion(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  if (!v || v.includes('${') || v.includes('%{')) return ''
  return v
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`
}

export function formatTime(ts: string | number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
