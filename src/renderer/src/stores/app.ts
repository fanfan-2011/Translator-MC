import { create } from 'zustand'
import type { AppSettings, EntryStatus, GlossaryEntry, PackageInfo, Project, TranslationEntry } from '@shared/types'
import { api, type TranslateProgress, type ReviewProgress } from '../api'
import { DEFAULT_LLM_CONFIG, type LLMConfig } from '@shared/types'

export type View = 'home' | 'workspace' | 'glossary' | 'memory' | 'history' | 'logs'

export type Toast = { id: number; kind: 'info' | 'success' | 'error'; text: string }

interface AppState {
  theme: 'light' | 'dark' | 'system'
  view: View
  currentProjectId: string | null
  projects: Project[]
  packages: PackageInfo[]
  entries: TranslationEntry[]
  glossary: GlossaryEntry[]
  llmConfig: LLMConfig
  settings: AppSettings
  // task
  task: TranslateProgress | null
  reviewing: ReviewProgress | null
  // modals
  settingsOpen: boolean
  exportOpen: boolean
  importOpen: boolean
  importPaths: string[]
  issueOpen: boolean
  // toast
  toast: Toast | null

  setTheme: (t: 'light' | 'dark' | 'system') => void
  setView: (v: View) => void
  createProject: (name?: string) => Promise<string>
  openProject: (id: string) => Promise<void>
  closeProject: () => void
  openImport: (paths: string[]) => void
  toastMsg: (text: string, kind?: Toast['kind']) => void

  loadProjects: () => Promise<void>
  loadProjectData: (projectId: string) => Promise<void>
  loadGlossary: () => Promise<void>
  loadLlmConfig: () => Promise<void>
  loadSettings: () => Promise<void>

  setTask: (t: TranslateProgress | null) => void
  setReviewing: (r: ReviewProgress | null) => void
  setSettingsOpen: (v: boolean) => void
  setExportOpen: (v: boolean) => void
  setImportOpen: (v: boolean) => void
  setIssueOpen: (v: boolean) => void
}

let toastId = 0

/** 用户主动切换主题的标记（由 setTheme 置位，useTheme 采样后消费） */
let userThemeSwitch = false

/** 取出并清除「用户主动切换」标记；只有这种切换才做性能采样 */
export function consumeUserThemeSwitch(): boolean {
  const v = userThemeSwitch
  userThemeSwitch = false
  return v
}

export const useApp = create<AppState>((set, get) => ({
  theme: 'system',
  view: 'home',
  currentProjectId: null,
  projects: [],
  packages: [],
  entries: [],
  glossary: [],
  llmConfig: { ...DEFAULT_LLM_CONFIG },
  settings: { theme: 'system' },
  task: null,
  reviewing: null,
  settingsOpen: false,
  exportOpen: false,
  importOpen: false,
  importPaths: [],
  issueOpen: false,
  toast: null,

  setTheme: (t) => {
    // 标记为「用户主动切换」：只有这种切换才值得做性能采样
    // （启动时读配置、跟随系统变化造成的切换会混入启动渲染的长帧，曾因此误判降级）
    userThemeSwitch = true
    set({ theme: t })
    void api.setSettings({ ...get().settings, theme: t })
  },

  setView: (v) => set({ view: v }),

  createProject: async (name) => {
    const trimmed = (name ?? '').trim()
    const finalName = trimmed || `新项目 ${get().projects.length + 1}`
    const project = await api.createProject(finalName)
    await get().loadProjects()
    return project.id
  },

  openProject: async (id) => {
    set({ currentProjectId: id, view: 'workspace', task: null })
    await get().loadProjectData(id)
  },

  closeProject: () => set({ currentProjectId: null, packages: [], entries: [], view: 'home' }),

  openImport: (paths) => set({ importPaths: paths, importOpen: paths.length > 0 }),

  toastMsg: (text, kind = 'info') => {
    const id = ++toastId
    set({ toast: { id, kind, text } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3600)
  },

  loadProjects: async () => {
    const projects = await api.listProjects()
    set({ projects })
  },

  loadProjectData: async (projectId) => {
    const [packages, entries] = await Promise.all([api.listPackages(projectId), api.listEntries(projectId)])
    set({ packages, entries })
  },

  loadGlossary: async () => {
    const glossary = await api.listGlossary()
    set({ glossary })
  },

  loadLlmConfig: async () => {
    const llmConfig = await api.getLlmConfig()
    set({ llmConfig })
  },

  loadSettings: async () => {
    const settings = await api.getSettings()
    set({ settings, theme: settings.theme })
  },

  setTask: (task) => set({ task }),
  setReviewing: (reviewing) => set({ reviewing }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setImportOpen: (importOpen) => set({ importOpen, importPaths: importOpen ? get().importPaths : [] }),
  setIssueOpen: (issueOpen) => set({ issueOpen })
}))

// Re-export types used elsewhere
export type { EntryStatus }
