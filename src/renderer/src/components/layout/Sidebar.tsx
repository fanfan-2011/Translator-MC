import {
  Folder,
  Languages,
  BookOpen,
  Brain,
  History,
  ScrollText,
  Settings,
  Upload,
  type LucideIcon
} from 'lucide-react'
import { useApp, type View } from '../../stores/app'

interface NavItem {
  id: View
  label: string
  icon: LucideIcon
}

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: '工作区',
    items: [
      { id: 'home', label: '项目', icon: Folder },
      { id: 'workspace', label: '翻译任务', icon: Languages },
      { id: 'glossary', label: '术语表', icon: BookOpen },
      { id: 'memory', label: '翻译记忆', icon: Brain },
      { id: 'history', label: '历史', icon: History }
    ]
  },
  {
    title: '工具',
    items: [{ id: 'logs', label: '开发者日志', icon: ScrollText }]
  }
]

export function Sidebar(): JSX.Element {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const setSettingsOpen = useApp((s) => s.setSettingsOpen)
  const setExportOpen = useApp((s) => s.setExportOpen)
  const currentProjectId = useApp((s) => s.currentProjectId)

  const go = (id: View): void => {
    if (id === 'workspace' && !currentProjectId) {
      setView('home')
      return
    }
    setView(id)
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g.title} className="mb-4">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {g.title}
            </div>
            {g.items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    view === item.id
                      ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}

        <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">工具</div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings className="h-4 w-4 shrink-0" />
          AI 设置
        </button>
        <button
          onClick={() => setExportOpen(true)}
          className="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Upload className="h-4 w-4 shrink-0" />
          导出
        </button>
      </nav>
    </aside>
  )
}
