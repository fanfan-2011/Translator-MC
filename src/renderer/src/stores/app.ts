import { create } from 'zustand'
import type { AppSettings, EntryStatus, GlossaryEntry, PackageInfo, Project, TranslationEntry } from '@shared/types'
import { api, type TranslateProgress } from '../api'
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
  reviewing: { done: number; total: number } | null
  // modals
  settingsOpen: boolean
  exportOpen: boolean
  importOpen: boolean
  issueOpen: boolean
  // toast
  toast: Toast | null

  setTheme: (t: 'light' | 'dark' | 'system') => void
  setView: (v: View) => void
  openProject: (id: string) => Promise<void>
  toastMsg: (text: string, kind?: Toast['kind']) => void

  loadProjects: () => Promise<void>
  loadProjectData: (projectId: string) => Promise<void>
  loadGlossary: () => Promise<void>
  loadLlmConfig: () => Promise<void>
  loadSettings: () => Promise<void>

  setTask: (t: TranslateProgress | null) => void
  setReviewing: (r: { done: number; total: number } | null) => void
  setSettingsOpen: (v: boolean) => void
  setExportOpen: (v: boolean) => void
  setImportOpen: (v: boolean) => void
  setIssueOpen: (v: boolean) => void
}

let toastId = 0

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
  issueOpen: false,
  toast: null,

  setTheme: (t) => {
    set({ theme: t })
    void api.setSettings({ theme: t })
  },

  setView: (v) => set({ view: v }),

  openProject: async (id) => {
    set({ currentProjectId: id, view: 'workspace', task: null })
    await get().loadProjectData(id)
  },

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
  setImportOpen: (importOpen) => set({ importOpen }),
  setIssueOpen: (issueOpen) => set({ issueOpen })
}))

// Re-export types used elsewhere
export type { EntryStatus }
