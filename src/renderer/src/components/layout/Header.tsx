import { Sun, Moon, Monitor, Settings, HelpCircle } from 'lucide-react'
import logo from '../../assets/logo.png'
import { useApp } from '../../stores/app'
import { api } from '../../api'

export function Header(): JSX.Element {
  const projects = useApp((s) => s.projects)
  const currentProjectId = useApp((s) => s.currentProjectId)
  const openProject = useApp((s) => s.openProject)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)

  const current = projects.find((p) => p.id === currentProjectId)

  const cycleTheme = (): void => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Translator MC" className="h-8 w-auto" />
        {current ? (
          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {current.name}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {projects.length > 0 ? (
          <select
            className="h-8 max-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            value={currentProjectId ?? ''}
            onChange={(e) => {
              if (e.target.value) void openProject(e.target.value)
            }}
          >
            <option value="" disabled>
              选择项目…
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          onClick={cycleTheme}
          title="切换主题"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {theme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="设置"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={() => void api.openHelp()}
          title="帮助"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
