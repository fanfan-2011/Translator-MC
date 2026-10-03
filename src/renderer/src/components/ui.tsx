import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Minus, X } from 'lucide-react'

/* ------------------------------------------------------------------
   基础组件库 —— 全部按 design/UI-SPEC.md 第 3 节的实测规格实现。
   颜色只用语义令牌（bg-surface / text-ink / border-line…），
   令牌本身分亮暗两套，所以组件里不需要写 dark: 变体。
   ------------------------------------------------------------------ */

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg font-bold shadow-primary hover:brightness-95',
  secondary: 'bg-surface text-ink border border-line-3 font-semibold hover:bg-hover',
  soft: 'bg-surface-2 text-ink border border-line font-semibold hover:bg-hover',
  ghost: 'text-muted font-medium hover:bg-hover hover:text-ink',
  danger: 'bg-danger text-primary-fg font-semibold hover:brightness-95'
}

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-[33px] px-3.5 text-base gap-2',
  lg: 'h-10 px-[18px] text-base gap-2'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return (
    <button
      className={`app-nodrag inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,box-shadow,filter,opacity] disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------- IconButton ----------
export function IconButton({
  className = '',
  active = false,
  children,
  ...props
}: {
  className?: string
  active?: boolean
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return (
    <button
      className={`app-nodrag flex h-8 w-8 shrink-0 items-center justify-center rounded-input text-[color:var(--tsm-toggle-icon)] transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'bg-hover' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------- Badge ----------
export function Badge({
  className = '',
  children,
  title
}: {
  className?: string
  children: ReactNode
  title?: string
}): JSX.Element {
  return (
    <span
      title={title}
      className={`inline-flex h-[19px] items-center rounded-full px-2 text-2xs font-medium leading-none ${className}`}
    >
      {children}
    </span>
  )
}

// ---------- Chip（小信息块，如 大小 / 版本）----------
export function Chip({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <span
      className={`inline-flex h-[23px] min-w-0 max-w-full items-center gap-1 rounded-full bg-sunken px-2 text-xs font-medium text-muted ${className}`}
    >
      <span className="truncate-1">{children}</span>
    </span>
  )
}

// ---------- CodeChip（key 代码块）----------
export function CodeChip({
  children,
  className = '',
  title
}: {
  children: ReactNode
  className?: string
  title?: string
}): JSX.Element {
  return (
    <span
      title={title}
      className={`inline-flex h-[21px] min-w-0 max-w-full items-center rounded-chip border border-line-4 bg-code px-1.5 font-mono text-2xs text-key ${className}`}
    >
      <span className="truncate-1">{children}</span>
    </span>
  )
}

// ---------- Card ----------
export function Card({
  className = '',
  children,
  ...props
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={`rounded-card border border-line bg-surface shadow-card ${className}`} {...props}>
      {children}
    </div>
  )
}

// ---------- Spinner ----------
export function Spinner({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ---------- ProgressBar ----------
export function ProgressBar({ value, className = '' }: { value: number; className?: string }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-sunken ${className}`}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------- Checkbox ----------
export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  title
}: {
  checked: boolean
  onChange: (v: boolean) => void
  indeterminate?: boolean
  disabled?: boolean
  title?: string
}): JSX.Element {
  const on = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-chip border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'border-accent bg-accent text-primary-fg' : 'border-line-3 bg-surface hover:border-accent'
      }`}
    >
      {indeterminate ? (
        <Minus className="h-2.5 w-2.5" strokeWidth={3.5} />
      ) : checked ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      ) : null}
    </button>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-2xl'
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[color:var(--tsm-overlay)]" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[85vh] w-full ${width} flex-col overflow-hidden rounded-card border border-line bg-surface shadow-update`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <IconButton onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ---------- 表单 ----------
export function Field({
  label,
  children,
  hint,
  tooltip,
  className = ''
}: {
  label: string
  children: ReactNode
  hint?: string
  tooltip?: ReactNode
  className?: string
}): JSX.Element {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-2">
        {label}
        {tooltip ? <Tooltip content={tooltip} /> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-2xs text-muted-4">{hint}</span> : null}
    </label>
  )
}

const INPUT_BASE =
  'w-full rounded-input border border-line-2 bg-surface px-2.5 text-sm text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-sunken'

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className={`${INPUT_BASE} h-[30px] ${className}`} {...props} />
}

export function Textarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea className={`${INPUT_BASE} resize-y py-1.5 leading-relaxed ${className}`} {...props} />
}

export function Select({
  value,
  onChange,
  children,
  className = '',
  disabled = false
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
  disabled?: boolean
}): JSX.Element {
  return (
    <div className={`relative ${className}`}>
      <select
        disabled={disabled}
        className={`${INPUT_BASE} h-[30px] cursor-pointer appearance-none pr-7`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
    </div>
  )
}

// ---------- Dropdown（自定义下拉：pill 按钮 + 浮层菜单）----------
export interface DropdownOption {
  value: string
  label: string
}

export function Dropdown({
  value,
  options,
  onChange,
  prefix,
  className = '',
  align = 'left',
  shape = 'box',
  disabled = false
}: {
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
  prefix?: string
  className?: string
  align?: 'left' | 'right'
  shape?: 'pill' | 'box'
  disabled?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)
  const shapeCls = shape === 'pill' ? 'rounded-full px-3 shadow-input' : 'rounded-input px-3'
  const sizeCls = shape === 'pill' ? 'h-[33px]' : 'h-[30px]'

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`app-nodrag relative shrink-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 border border-line-2 bg-surface text-sm font-medium text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 ${sizeCls} ${shapeCls}`}
      >
        {prefix ? <span className="font-medium text-muted">{prefix}</span> : null}
        <span className="max-w-40 truncate-1">{current?.label ?? value}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-2" strokeWidth={2} />
      </button>
      {open ? (
        <div
          className={`absolute z-40 mt-1 max-h-72 min-w-[152px] overflow-y-auto rounded-sm border border-line bg-surface py-1 shadow-menu ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={`flex h-8 w-full items-center px-3 text-left text-sm transition-colors hover:bg-hover ${
                o.value === value ? 'bg-selected font-medium text-ink-2' : 'text-ink-3'
              }`}
            >
              <span className="truncate-1">{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------- SegmentedControl（液态玻璃分段控件 / 主题切换）----------
/**
 * 三层结构：底层纯色（随主题切换的整块底）→ 顶层玻璃滑块（唯一会平移的部件）→ 文字。
 * 顶层玻璃保留模糊 / 折射 / 边缘高光；切换时只有它平移，另加液态回弹与高光扫过。
 * data-tone 由宿主背景亮度实测得出（不依赖主题名），玻璃面与文字颜色随之自适应。
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  showLabels = false,
  className = ''
}: {
  value: T
  options: { value: T; label: string; icon: ReactNode }[]
  onChange: (v: T) => void
  showLabels?: boolean
  className?: string
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)
  const firstGlint = useRef(true)
  const [tone, setTone] = useState<'light' | 'dark'>('light')
  const [moving, setMoving] = useState(false)
  const [reglint, setReglint] = useState(false)
  const count = Math.max(1, options.length)
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  // 玻璃 / 文字配色自适应：向上取第一个不透明背景，按 WCAG 相对亮度判明暗。
  // 用 layout effect：主题切换时与根节点 class 同帧生效，避免高光/配色掉队一帧。
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const measure = (): void => {
      let node: HTMLElement | null = el.parentElement
      let bg = ''
      while (node) {
        const c = getComputedStyle(node).backgroundColor
        const m = c.match(/rgba?\(([^)]+)\)/)
        if (m) {
          const parts = m[1].split(',').map((x) => parseFloat(x))
          const alpha = parts.length > 3 ? parts[3] : 1
          if (alpha > 0.5) {
            bg = c
            break
          }
        }
        node = node.parentElement
      }
      const nums = bg.match(/\d+(\.\d+)?/g)
      if (!nums || nums.length < 3) return
      const lin = (v: number): number => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      }
      const lum = 0.2126 * lin(+nums[0]) + 0.7152 * lin(+nums[1]) + 0.0722 * lin(+nums[2])
      setTone(lum > 0.42 ? 'light' : 'dark')
    }
    measure()
    // 主题切换（根节点 class / data-theme 变化）后重新测一次
    const mo = new MutationObserver(measure)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style']
    })
    window.addEventListener('resize', measure)
    return () => {
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // 边缘高光随位移：挂在最近的可滚动祖先上做视差（设置弹窗正文可滚动）
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let node: HTMLElement | null = el.parentElement
    let scroller: HTMLElement | null = null
    while (node) {
      const oy = getComputedStyle(node).overflowY
      if (oy === 'auto' || oy === 'scroll') {
        scroller = node
        break
      }
      node = node.parentElement
    }
    if (!scroller) return
    const target = scroller
    let raf = 0
    const onScroll = (): void => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const shift = Math.max(-8, Math.min(8, target.scrollTop * 0.06))
        el.style.setProperty('--tsm-glass-shift', `${shift.toFixed(2)}px`)
      })
    }
    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // 液态回弹 + 高光跟随：用 layout effect，让动画类与位移在同一帧生效
  // （用 useEffect 会晚一帧，视觉上就是「高光跟不上滑块」）；时长与滑块 280ms 对齐
  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setMoving(true)
    const t = window.setTimeout(() => setMoving(false), 300)
    return () => window.clearTimeout(t)
  }, [value])

  // 宿主明暗翻转（黑白主题切换）时单独触发一次「重新反光」，避免高光只是跟着颜色硬切
  useLayoutEffect(() => {
    if (firstGlint.current) {
      firstGlint.current = false
      return
    }
    setReglint(true)
    const t = window.setTimeout(() => setReglint(false), 300)
    return () => window.clearTimeout(t)
  }, [tone])

  return (
    <div
      ref={trackRef}
      role="group"
      data-tone={tone}
      className={`tsm-glass h-9 ${className}`}
      style={
        {
          gridTemplateColumns: `repeat(${count}, minmax(36px, 1fr))`,
          // 运动学唯一来源：滑块位移与高光都从这两个变量派生（见 index.css）
          '--tsm-glass-i': String(index),
          '--tsm-glass-i-lag': String(index)
        } as React.CSSProperties
      }
    >
      {/* 顶层：唯一会移动的部件 */}
      <span
        aria-hidden="true"
        className="tsm-glass__pill"
        data-moving={moving ? 'true' : 'false'}
        data-reglint={reglint ? 'true' : 'false'}
        style={{ width: `calc((100% - 4px) / ${count})` } as React.CSSProperties}
      >
        <span />
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="tsm-glass__btn app-nodrag"
        >
          <span className="shrink-0">{o.icon}</span>
          {showLabels ? <span className="truncate-1 text-xs font-medium">{o.label}</span> : null}
        </button>
      ))}
    </div>
  )
}

// ---------- EmptyState ----------
export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-surface-2 text-link">
        {icon}
      </div>
      <div className="text-lg font-semibold text-ink">{title}</div>
      {description ? <div className="max-w-md text-center text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-2 flex gap-2">{action}</div> : null}
    </div>
  )
}

// ---------- Tooltip（标签旁的 ? 悬浮说明）----------
export function Tooltip({
  content,
  align = 'left',
  className = ''
}: {
  content: ReactNode
  align?: 'left' | 'right'
  className?: string
}): JSX.Element {
  return (
    <span className={`group relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="字段说明"
        onClick={(e) => e.preventDefault()}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line-3 text-[9px] font-semibold leading-none text-muted-4 transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:border-accent focus-visible:text-accent"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+6px)] z-50 hidden w-max max-w-[248px] rounded-sm border border-line bg-surface px-2.5 py-1.5 text-left text-2xs font-normal leading-relaxed text-muted shadow-menu group-hover:block group-focus-within:block ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {content}
      </span>
    </span>
  )
}

// ---------- Slider（滑动条，数值实时回显）----------
export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  disabled = false,
  format = (v: number): string => String(v),
  className = ''
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  format?: (v: number) => string
  className?: string
}): JSX.Element {
  const clamped = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tsm-slider min-w-0 flex-1"
        style={{ '--tsm-slider-fill': `${pct}%` } as React.CSSProperties}
      />
      <span className="w-11 shrink-0 rounded-chip bg-sunken px-1.5 py-0.5 text-center font-machine text-xs font-semibold text-ink">
        {format(clamped)}
      </span>
    </div>
  )
}

// ---------- SectionCard（设置页的分区卡片）----------
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = ''
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={`rounded-card border border-line bg-surface-2 p-4 ${className}`}>
      <header className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? <span className="text-2xs text-muted-4">{subtitle}</span> : null}
        <span className="min-w-0 flex-1" />
        {action}
      </header>
      {children}
    </section>
  )
}

// ---------- Collapsible（可折叠分区，默认收起）----------
export function Collapsible({
  title,
  subtitle,
  summary,
  defaultOpen = false,
  children,
  className = ''
}: {
  title: string
  subtitle?: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-card border border-line bg-surface-2 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-card px-4 py-3 text-left transition-colors hover:bg-hover"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-2 transition-transform ${open ? '' : '-rotate-90'}`}
          strokeWidth={2}
        />
        <span className="shrink-0 text-sm font-semibold text-ink">{title}</span>
        {subtitle ? <span className="shrink-0 text-2xs text-muted-4">{subtitle}</span> : null}
        <span className="min-w-0 flex-1" />
        {!open && summary ? (
          <span className="truncate-1 font-machine text-2xs text-muted-3">{summary}</span>
        ) : null}
      </button>
      {open ? <div className="border-t border-line p-4">{children}</div> : null}
    </div>
  )
}
