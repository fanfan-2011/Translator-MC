import type {
  AppSettings,
  ExportOptions,
  ExportResult,
  GlossaryEntry,
  HistoryEntry,
  ImportResult,
  IssueRecord,
  LLMConfig,
  LogLine,
  MemoryEntry,
  ModelInfo,
  PackageInfo,
  Project,
  TaskInfo,
  TranslationEntry
} from '@shared/types'

export interface DetectedPreview {
  sourcePath: string
  type: 'mod' | 'shader' | 'resourcepack' | 'unknown'
  name: string
  version: string
  modId: string
  evidence: string[]
  entryCount: number
  builtinCount: number
}

// Typed facade over the preload bridge (window.api returns Promise<unknown>).
export const api = {
  listProjects: (): Promise<Project[]> => window.api.listProjects() as Promise<Project[]>,
  getProject: (id: string): Promise<Project | undefined> => window.api.getProject(id) as Promise<Project | undefined>,
  createProject: (name: string): Promise<Project> => window.api.createProject(name) as Promise<Project>,
  renameProject: (id: string, name: string): Promise<void> => window.api.renameProject(id, name) as Promise<void>,
  deleteProject: (id: string): Promise<void> => window.api.deleteProject(id) as Promise<void>,

  getPathForFile: (file: File): string => window.api.getPathForFile(file),
  selectFiles: (): Promise<string[]> => window.api.selectFiles(),
  selectDir: (): Promise<string[]> => window.api.selectDir(),
  previewPackage: (sourcePath: string, hint?: string, targetCode?: string): Promise<DetectedPreview> =>
    window.api.previewPackage(sourcePath, hint, targetCode) as Promise<DetectedPreview>,
  importFiles: (sourcePaths: string[], projectId?: string, hint?: string, targetCode?: string): Promise<ImportResult> =>
    window.api.importFiles(sourcePaths, projectId, hint, targetCode) as Promise<ImportResult>,

  listPackages: (projectId: string): Promise<PackageInfo[]> =>
    window.api.listPackages(projectId) as Promise<PackageInfo[]>,

  listEntries: (projectId: string): Promise<TranslationEntry[]> =>
    window.api.listEntries(projectId) as Promise<TranslationEntry[]>,
  updateEntryTarget: (id: string, target: string, status: string): Promise<void> =>
    window.api.updateEntryTarget(id, target, status) as Promise<void>,
  setSelected: (id: string, selected: boolean): Promise<void> => window.api.setSelected(id, selected) as Promise<void>,
  setSelectedMany: (ids: string[], selected: boolean): Promise<void> =>
    window.api.setSelectedMany(ids, selected) as Promise<void>,
  clearTarget: (id: string): Promise<void> => window.api.clearTarget(id) as Promise<void>,
  clearAllTargets: (projectId: string): Promise<void> => window.api.clearAllTargets(projectId) as Promise<void>,

  listGlossary: (): Promise<GlossaryEntry[]> => window.api.listGlossary() as Promise<GlossaryEntry[]>,
  addGlossary: (g: Omit<GlossaryEntry, 'id'>): Promise<GlossaryEntry> => window.api.addGlossary(g) as Promise<GlossaryEntry>,
  updateGlossary: (id: string, patch: Partial<Omit<GlossaryEntry, 'id'>>): Promise<void> =>
    window.api.updateGlossary(id, patch) as Promise<void>,
  deleteGlossary: (id: string): Promise<void> => window.api.deleteGlossary(id) as Promise<void>,

  listMemory: (): Promise<MemoryEntry[]> => window.api.listMemory() as Promise<MemoryEntry[]>,
  deleteMemoryMany: (ids: string[]): Promise<void> => window.api.deleteMemoryMany(ids) as Promise<void>,

  listHistory: (entryId: string): Promise<HistoryEntry[]> => window.api.listHistory(entryId) as Promise<HistoryEntry[]>,
  listAllHistory: (projectId: string): Promise<(HistoryEntry & { key: string })[]> =>
    window.api.listAllHistory(projectId) as Promise<(HistoryEntry & { key: string })[]>,
  deleteHistoryMany: (ids: string[]): Promise<void> => window.api.deleteHistoryMany(ids) as Promise<void>,

  listIssues: (projectId: string): Promise<IssueRecord[]> => window.api.listIssues(projectId) as Promise<IssueRecord[]>,
  setIssueResolved: (id: string, resolved: boolean): Promise<void> =>
    window.api.setIssueResolved(id, resolved) as Promise<void>,

  getSettings: (): Promise<AppSettings> => window.api.getSettings() as Promise<AppSettings>,
  setSettings: (s: AppSettings): Promise<void> => window.api.setSettings(s) as Promise<void>,

  getLlmConfig: (): Promise<LLMConfig> => window.api.getLlmConfig() as Promise<LLMConfig>,
  setLlmConfig: (config: LLMConfig): Promise<void> => window.api.setLlmConfig(config) as Promise<void>,
  listModels: (config: LLMConfig): Promise<ModelInfo[]> => window.api.listModels(config) as Promise<ModelInfo[]>,

  startTranslate: (projectId: string, options: unknown): Promise<unknown> => window.api.startTranslate(projectId, options),
  pauseTranslate: (taskId: string): Promise<void> => window.api.pauseTranslate(taskId) as Promise<void>,
  resumeTranslate: (taskId: string): Promise<void> => window.api.resumeTranslate(taskId) as Promise<void>,
  cancelTranslate: (taskId: string): Promise<void> => window.api.cancelTranslate(taskId) as Promise<void>,
  onTranslateProgress: (cb: (data: TranslateProgress) => void): (() => void) =>
    window.api.onTranslateProgress(cb as (d: unknown) => void),
  onTranslateDone: (cb: (data: TranslateDone) => void): (() => void) =>
    window.api.onTranslateDone(cb as (d: unknown) => void),

  startReview: (projectId: string): Promise<unknown> => window.api.startReview(projectId),
  pauseReview: (taskId: string): Promise<void> => window.api.pauseReview(taskId) as Promise<void>,
  resumeReview: (taskId: string): Promise<void> => window.api.resumeReview(taskId) as Promise<void>,
  cancelReview: (taskId: string): Promise<void> => window.api.cancelReview(taskId) as Promise<void>,
  onReviewProgress: (cb: (data: ReviewProgress) => void): (() => void) =>
    window.api.onReviewProgress(cb as (d: unknown) => void),
  onReviewDone: (cb: (data: ReviewDone) => void): (() => void) =>
    window.api.onReviewDone(cb as (d: unknown) => void),

  exportPreCheck: (projectId: string): Promise<{ count: number; messages: string[] }> =>
    window.api.exportPreCheck(projectId) as Promise<{ count: number; messages: string[] }>,
  exportSave: (projectId: string, options: ExportOptions, outputPath?: string): Promise<ExportResult> =>
    window.api.exportSave(projectId, options, outputPath) as Promise<ExportResult>,
  chooseExportPath: (defaultName: string, ext: string): Promise<string | null> =>
    window.api.chooseExportPath(defaultName, ext),

  getLogs: (): Promise<LogLine[]> => window.api.getLogs() as Promise<LogLine[]>,
  clearLogs: (): Promise<void> => window.api.clearLogs() as Promise<void>,

  openHelp: (): Promise<{ ok: boolean; error?: string }> =>
    window.api.openHelp() as Promise<{ ok: boolean; error?: string }>
}

export interface TranslateProgress {
  taskId: string
  status: string
  done: number
  total: number
  failed: number
  progress: number
}

export interface TranslateDone {
  ok: boolean
  translated: number
  reused: number
  failed: number
  cancelled: boolean
  error?: string
}

export interface ReviewProgress {
  taskId: string
  status: string
  done: number
  total: number
  failed: number
}

export interface ReviewDone {
  ok: boolean
  reviewed: number
  needsReview: number
  failed: number
  cancelled: boolean
  error?: string
}

export type { TaskInfo, TranslationEntry }
