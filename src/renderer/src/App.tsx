import { useEffect } from 'react'
import { useApp } from './stores/app'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { StatusBar } from './components/layout/StatusBar'
import { Home } from './components/home/Home'
import { TranslationWorkspace } from './components/workspace/TranslationWorkspace'
import { GlossaryPanel } from './components/glossary/GlossaryPanel'
import { MemoryPanel } from './components/memory/MemoryPanel'
import { HistoryPanel } from './components/history/HistoryPanel'
import { LogsPanel } from './components/logs/LogsPanel'
import { SettingsModal } from './components/settings/SettingsModal'
import { ExportModal } from './components/export/ExportModal'
import { IssuesPanel } from './components/issues/IssuesPanel'

function useTheme(): void {
  const theme = useApp((s) => s.theme)
  useEffect(() => {
    const apply = (): void => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])
}

function Toast(): JSX.Element | null {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  const color =
    toast.kind === 'error'
      ? 'bg-red-600'
      : toast.kind === 'success'
        ? 'bg-emerald-600'
        : 'bg-slate-800'
  return (
    <div className="pointer-events-none fixed bottom-12 left-1/2 z-[60] -translate-x-1/2">
      <div className={`rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${color}`}>{toast.text}</div>
    </div>
  )
}

function MainContent(): JSX.Element {
  const view = useApp((s) => s.view)
  const projectId = useApp((s) => s.currentProjectId)

  switch (view) {
    case 'workspace':
      return projectId ? <TranslationWorkspace /> : <Home />
    case 'glossary':
      return <GlossaryPanel />
    case 'memory':
      return <MemoryPanel />
    case 'history':
      return <HistoryPanel />
    case 'logs':
      return <LogsPanel />
    case 'home':
    default:
      return <Home />
  }
}

export default function App(): JSX.Element {
  useTheme()
  const loadProjects = useApp((s) => s.loadProjects)
  const loadSettings = useApp((s) => s.loadSettings)
  const loadLlmConfig = useApp((s) => s.loadLlmConfig)
  const loadGlossary = useApp((s) => s.loadGlossary)

  useEffect(() => {
    void loadSettings()
    void loadLlmConfig()
    void loadProjects()
    void loadGlossary()
  }, [loadSettings, loadLlmConfig, loadProjects, loadGlossary])

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <MainContent />
        </main>
      </div>
      <StatusBar />
      <SettingsModal />
      <ExportModal />
      <IssuesPanel />
      <Toast />
    </div>
  )
}
