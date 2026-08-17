import type { EntryStatus, PackageType, ThemePref } from '@shared/types'

export const STATUS_LABEL: Record<EntryStatus, string> = {
  pending: '未翻译',
  translating: '翻译中',
  ai_translated: 'AI 翻译',
  human_reviewed: '人工确认',
  builtin: '自带中文',
  skipped: '已跳过',
  failed: '失败',
  needs_review: '需审核'
}

export const STATUS_STYLE: Record<EntryStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  translating: 'bg-blue-100 text-blue-700',
  ai_translated: 'bg-indigo-100 text-indigo-700',
  human_reviewed: 'bg-emerald-100 text-emerald-700',
  builtin: 'bg-teal-100 text-teal-700',
  skipped: 'bg-slate-100 text-slate-400',
  failed: 'bg-red-100 text-red-600',
  needs_review: 'bg-amber-100 text-amber-700'
}

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
