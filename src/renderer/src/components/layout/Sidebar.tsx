import {
  BookOpen,
  Brain,
  Folder,
  FolderOutput,
  History,
  Languages,
  ScrollText,
  type LucideIcon
} from 'lucide-react'
import { useApp, type View } from '../../stores/app'
import { ModCard } from './ModCard'
import { SettingsBar } from './SettingsBar'
import { UpdateCard } from './UpdateCard'

interface NavItem {
  id: View | 'export'
  label: string
  icon: LucideIcon
}

const GROUPS: { title: string; items: NavItem[] }[] = [
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
    items: [
      { id: 'logs', label: '开发者日志', icon: ScrollText },
      { id: 'export', label: '导出', icon: FolderOutput }
    ]
  }
]

/**
 * 侧边栏 —— 设计稿 6:53 内的 21:4 / 35:2 / 36:101 / 36:122。
 * 宽 327，底色 #e6e6e6：mod 信息卡（上）→ 导航（中，可滚动）→
 * 更新卡 + 设置栏（下）。
 */
export function Sidebar(): JSX.Element {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const setExportOpen = useApp((s) => s.setExportOpen)
  const currentProjectId = useApp((s) => s.currentProjectId)

  const go = (id: NavItem['id']): void => {
    if (id === 'export') {
      setExportOpen(true)
      return
    }
    if (id === 'workspace' && !currentProjectId) {
      setView('home')
      return
    }
    setView(id)
  }

  return (
    <aside className="flex w-[327px] shrink-0 flex-col bg-bg">
      <div className="px-1.5 pt-[26px]">
        <ModCard />
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-1.5 pb-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-0.5">
            <div className="flex items-center px-3 py-2 text-xs font-medium text-link">{g.title}</div>
            {g.items.map((item) => {
              const Icon = item.icon
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`flex h-9 w-full items-center gap-[10px] rounded-input px-3 text-left text-base transition-colors ${
                    active
                      ? 'bg-selected font-semibold text-ink-2'
                      : 'font-medium text-ink-3 hover:bg-hover'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 px-1.5 pb-3.5">
        <UpdateCard />
        <SettingsBar />
      </div>
    </aside>
  )
}
