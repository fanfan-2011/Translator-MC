import { Monitor, Moon, Settings, Sun, HelpCircle } from 'lucide-react'
import { useApp } from '../../stores/app'
import { api } from '../../api'
import { SegmentedControl } from '../ui'

/**
 * 设置栏 —— 设计稿 36:122：287×40，玻璃底（#f5f7fa@50% + blur 20），
 * 圆角 12，H gap8 pad 0/12。左侧主题切换（三段），右侧设置 / 帮助。
 */
export function SettingsBar(): JSX.Element {
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)

  return (
    <div
      className="glass flex h-10 w-full items-center gap-2 rounded-sm border px-3"
      style={{ background: 'var(--tsm-glass-bg)', borderColor: 'var(--tsm-glass-border)' }}
    >
      <SegmentedControl
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: '亮色', icon: <Sun className="h-3.5 w-3.5" strokeWidth={1.7} /> },
          { value: 'dark', label: '暗色', icon: <Moon className="h-3.5 w-3.5" strokeWidth={1.7} /> },
          {
            value: 'system',
            label: '跟随系统',
            icon: <Monitor className="h-3.5 w-3.5" strokeWidth={1.7} />
          }
        ]}
      />
      <div className="flex-1" />
      <button
        type="button"
        title="设置"
        onClick={() => setSettingsOpen(true)}
        className="app-nodrag flex h-8 w-8 items-center justify-center rounded-input text-[color:var(--tsm-toggle-icon)] transition-colors hover:bg-hover"
      >
        <Settings className="h-[21px] w-[21px]" strokeWidth={1.7} />
      </button>
      <button
        type="button"
        title="帮助"
        onClick={() => void api.openHelp()}
        className="app-nodrag flex h-8 w-8 items-center justify-center rounded-input text-[color:var(--tsm-toggle-icon)] transition-colors hover:bg-hover"
      >
        <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </button>
    </div>
  )
}
