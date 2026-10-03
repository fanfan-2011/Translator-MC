import { STATUS_LABEL } from '../../lib/status'
import { Dropdown, type DropdownOption } from '../ui'

export type StatusFilter =
  | 'all'
  | 'pending'
  | 'translating'
  | 'ai_translated'
  | 'human_reviewed'
  | 'builtin'
  | 'skipped'
  | 'failed'
  | 'needs_review'
  | 'needs_attention'

export type QualityFilter = 'all' | 'low' | 'scored'

const STATUS_OPTIONS: DropdownOption[] = [
  { value: 'all', label: '全部状态' },
  ...(['pending', 'translating', 'ai_translated', 'human_reviewed', 'builtin', 'skipped', 'failed', 'needs_review'] as const).map(
    (s) => ({ value: s, label: STATUS_LABEL[s] })
  ),
  { value: 'needs_attention', label: '需要关注' }
]

const QUALITY_OPTIONS: DropdownOption[] = [
  { value: 'all', label: '全部质量' },
  { value: 'low', label: '质量 < 70' },
  { value: 'scored', label: '已有评分' }
]

/**
 * 搜索栏 —— 设计稿 45:2：h57，底 #fafafc，底边 1px #e5e8ed，H gap12 pad 12/16。
 * 搜索框 267×32（圆角 8，占位符 #99a1ab，无图标前缀），
 * 两个筛选下拉 30px 高（圆角 8），右侧「共 N 条」13px #80858c。
 */
export function WorkspaceFilters({
  search,
  onSearch,
  status,
  onStatus,
  quality,
  onQuality,
  total,
  shown
}: {
  search: string
  onSearch: (v: string) => void
  status: StatusFilter
  onStatus: (v: StatusFilter) => void
  quality: QualityFilter
  onQuality: (v: QualityFilter) => void
  total: number
  shown: number
}): JSX.Element {
  return (
    <div className="flex h-[57px] shrink-0 items-center gap-3 border-b border-line bg-surface-3 px-4">
      <div className="relative w-[267px] shrink-0">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索 key / 原文 / 译文 / 备注(按Enter确认）"
          className="h-8 w-full rounded-input border border-line-2 bg-surface px-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
      </div>

      <Dropdown
        value={status}
        options={STATUS_OPTIONS}
        onChange={(v) => onStatus(v as StatusFilter)}
      />
      <Dropdown
        value={quality}
        options={QUALITY_OPTIONS}
        onChange={(v) => onQuality(v as QualityFilter)}
      />

      <div className="min-w-0 flex-1" />

      <span className="shrink-0 text-sm text-muted-3">
        共 {shown === total ? total : `${shown} / ${total}`} 条
      </span>
    </div>
  )
}
