import { Check, X } from 'lucide-react'
import { useState } from 'react'
import type { CheckResult, InstallerKind, ReleaseInfo, UpdatePrefs, UpdateSource } from '../../api'

/**
 * 「配置更新」弹窗 —— Figma 63:325（485×480，r28，固定奶油色）
 *   · top-bar 32（右上关闭 32×32 r8）
 *   · header 81：标题「配置更新」30 Bold + 版本胶囊 277×37（r999 白底 14px）
 *   · 「1.选择更新源」22 SemiBold → 两张源卡 212/214×78（r16 pad18 gap8：15 SemiBold 标题 + 13 Regular 说明）
 *   · 「2.选择安装包类型」→「记住本次设置」行（checkbox 22×22 r6 + 15px）
 *        → 两张类型卡 214/212×54（r16 pad18：15 SemiBold）
 *   · 「备份用户配置文件（推荐）」行 + 动作区 437×48：取消 214×48 r14 ／ 立即更新 212×48 r14
 *   · **选中态**（Figma 71:9 gitcode-option / 79:7 exe-option）：2px #16a34a 描边 + 右上 22×22 圆形对勾徽章
 *   · 未选中态（71:6 github-option / 79:10 zip-option）：1px #e8dccb 描边
 */
export interface UpdateChoice {
  source: UpdateSource
  kind: InstallerKind
  remember: boolean
  backup: boolean
}

export function UpdateOptionsModal({
  info,
  prefs,
  busy = false,
  error,
  onCancel,
  onConfirm
}: {
  info: CheckResult
  prefs: UpdatePrefs | null
  busy?: boolean
  error?: string
  onCancel: () => void
  onConfirm: (choice: UpdateChoice) => void
}): JSX.Element | null {
  const best = info.best
  const [source, setSource] = useState<UpdateSource>(prefs?.source ?? best?.source ?? 'github')
  const [kind, setKind] = useState<InstallerKind>(prefs?.kind ?? 'exe')
  const [remember, setRemember] = useState(prefs ? prefs.remember : true)
  const [backup, setBackup] = useState(prefs ? prefs.backup : false)
  if (!best) return null

  const usable = (s: UpdateSource, k: InstallerKind): boolean => {
    const rel: ReleaseInfo | null = s === 'github' ? info.perSource.github : info.perSource.gitcode
    return !!rel?.assets[k]
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.45)] p-6">
      <div className="tsm-upd-scroll flex max-h-[calc(100vh-3rem)] w-[485px] flex-col gap-[11px] overflow-y-auto rounded-upd border border-upd-line bg-upd-bg p-6 shadow-menu">
        {/* top-bar */}
        <div className="flex h-8 items-center justify-end">
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-win text-upd-ink transition-colors hover:bg-[rgba(31,31,31,0.07)]"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        {/* header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-upd-h2 font-bold text-upd-ink">配置更新</h2>
          <div className="flex h-[37px] w-fit min-w-[277px] items-center gap-2.5 whitespace-nowrap rounded-full border border-upd-line bg-upd-white px-3.5 text-[14px] leading-none">
            <span className="font-semibold text-upd-ink">版本 {best.version}</span>
            <span className="text-upd-muted">•</span>
            <span className="font-semibold text-upd-accent">{best.commit ?? '未知'}</span>
            <span className="text-upd-muted">最近一次提交</span>
          </div>
        </div>

        {/* 1. 选择更新源 */}
        <div className="flex flex-col gap-2.5">
          <div className="text-upd-h3 font-semibold text-upd-ink">1.选择更新源</div>
          <div className="flex gap-3">
            <OptionCard
              className="h-[78px] w-[212px] flex-col gap-2"
              title="GitHub（国际网络）"
              hint="适合稳定网络环境"
              selected={source === 'github'}
              disabled={!usable('github', kind)}
              onClick={() => setSource('github')}
            />
            <OptionCard
              className="h-[78px] w-[214px] flex-col gap-2"
              title="GitCode（国内网络）"
              hint="推荐国内网络使用"
              selected={source === 'gitcode'}
              disabled={!usable('gitcode', kind)}
              onClick={() => setSource('gitcode')}
            />
          </div>
        </div>

        {/* 2. 选择安装包类型 */}
        <div className="flex flex-col gap-2.5">
          <div className="text-upd-h3 font-semibold text-upd-ink">2.选择安装包类型</div>
          <CheckRow checked={remember} onChange={setRemember} label="记住本次设置" />
          <div className="flex gap-3">
            <OptionCard
              className="h-[54px] w-[214px]"
              title="exe安装包（推荐）"
              selected={kind === 'exe'}
              disabled={!usable(source, 'exe')}
              onClick={() => setKind('exe')}
            />
            <OptionCard
              className="h-[54px] w-[212px]"
              title="zip便携版"
              selected={kind === 'zip'}
              disabled={!usable(source, 'zip')}
              onClick={() => setKind('zip')}
            />
          </div>
        </div>

        {/* 备份 + 动作 */}
        <div className="flex flex-col gap-2.5">
          <CheckRow checked={backup} onChange={setBackup} label="备份用户配置文件（推荐）" />
          {error ? <div className="text-xs text-danger">{error}</div> : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-12 flex-1 rounded-tile border border-upd-line bg-upd-white text-upd-body2 font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98] disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || !usable(source, kind)}
              onClick={() => onConfirm({ source, kind, remember, backup })}
              className="h-12 flex-1 rounded-tile bg-upd-accent text-upd-body2 font-semibold text-upd-white transition-[filter] hover:brightness-95 disabled:opacity-60"
            >
              {busy ? '准备中…' : '立即更新'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OptionCard({
  title,
  hint,
  selected,
  disabled,
  onClick,
  className = ''
}: {
  title: string
  hint?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-start rounded-card bg-upd-white p-[18px] text-left transition-colors ${
        selected ? 'border-2 border-upd-sel' : 'border border-upd-line'
      } ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:brightness-[0.99]'} ${className}`}
    >
      <span className="flex flex-col gap-1">
        <span className="text-md font-semibold text-upd-ink">{title}</span>
        {hint ? <span className="text-sm text-upd-muted">{hint}</span> : null}
      </span>
      {selected ? (
        <span className="absolute right-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-upd-sel text-upd-white">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  )
}

function CheckRow({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex h-[22px] items-center gap-2.5 text-left"
    >
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-win border transition-colors ${
          checked ? 'border-upd-sel bg-upd-sel text-upd-white' : 'border-upd-line bg-upd-white'
        }`}
      >
        {checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span className="text-md text-upd-ink">{label}</span>
    </button>
  )
}
