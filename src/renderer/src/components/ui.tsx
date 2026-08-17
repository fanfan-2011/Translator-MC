import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

// ---------- Button ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const btnVariant: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
}
const btnSize: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3.5 text-sm',
  lg: 'h-10 px-5 text-sm'
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${btnVariant[variant]} ${btnSize[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ---------- Badge ----------
export function Badge({ className = '', children }: { className?: string; children: ReactNode }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${className}`}
    >
      {children}
    </span>
  )
}

// ---------- Spinner ----------
export function Spinner({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ---------- ProgressBar ----------
export function ProgressBar({ value, className = '' }: { value: number; className?: string }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-2xl'
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[85vh] w-full ${width} overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(85vh-57px)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ---------- Form fields ----------
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input className={`${inputBase} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea className={`${inputBase} resize-y ${className}`} {...props} />
}

export function Select({
  value,
  onChange,
  children,
  className = ''
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <select
      className={`${inputBase} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  )
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false
}: {
  checked: boolean
  onChange: (v: boolean) => void
  indeterminate?: boolean
}): JSX.Element {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
      }}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}
