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
  deleteHistoryMany: (ids: string[], projectId?: string): Promise<void> =>
    window.api.deleteHistoryMany(ids, projectId) as Promise<void>,

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
    window.api.openHelp() as Promise<{ ok: boolean; error?: string }>,

  // 窗口控制（自绘顶栏）
  windowState: (): Promise<boolean> => window.api.windowState() as Promise<boolean>,
  minimizeWindow: (): Promise<void> => window.api.minimizeWindow() as Promise<void>,
  toggleMaximize: (): Promise<boolean> => window.api.toggleMaximize() as Promise<boolean>,
  closeWindow: (): Promise<void> => window.api.closeWindow() as Promise<void>,
  onWindowState: (cb: (maximized: boolean) => void): (() => void) => window.api.onWindowState(cb),

  // 更新与用户配置（v2.1.0）
  checkUpdate: (): Promise<CheckResult> => window.api.checkUpdate() as Promise<CheckResult>,
  getUpdatePrefs: (): Promise<UpdatePrefs> => window.api.getUpdatePrefs() as Promise<UpdatePrefs>,
  setUpdatePrefs: (patch: Partial<UpdatePrefs>): Promise<UpdatePrefs> =>
    window.api.setUpdatePrefs(patch) as Promise<UpdatePrefs>,
  getUpdateState: (): Promise<UpdateProgressState> => window.api.getUpdateState() as Promise<UpdateProgressState>,
  fitUpdateWindow: (metrics: {
    innerWidth: number
    innerHeight: number
    neededWidth: number
    neededHeight: number
  }): Promise<{ ok: boolean; resized?: boolean }> =>
    window.api.fitUpdateWindow(metrics) as Promise<{ ok: boolean; resized?: boolean }>,
  startUpdate: (req: { source: UpdateSource; kind: InstallerKind; backup?: boolean; remember?: boolean }): Promise<UpdateStartResult> =>
    window.api.startUpdate(req) as Promise<UpdateStartResult>,
  cancelUpdate: (): Promise<{ ok: boolean }> => window.api.cancelUpdate() as Promise<{ ok: boolean }>,
  closeUpdateWindow: (): Promise<{ ok: boolean }> => window.api.closeUpdateWindow() as Promise<{ ok: boolean }>,
  /** 失败出路：打开 Release 下载页 / 打开下载目录 */
  openUpdatePage: (): Promise<{ ok: boolean; error?: string }> =>
    window.api.openUpdatePage() as Promise<{ ok: boolean; error?: string }>,
  openUpdateFolder: (): Promise<{ ok: boolean; error?: string }> =>
    window.api.openUpdateFolder() as Promise<{ ok: boolean; error?: string }>,
  exportConfig: (): Promise<ConfigExportResult> => window.api.exportConfig() as Promise<ConfigExportResult>,
  importConfig: (): Promise<ConfigImportResult> => window.api.importConfig() as Promise<ConfigImportResult>,
  onUpdateProgress: (cb: (s: UpdateProgressState) => void): (() => void) =>
    window.api.onUpdateProgress((d: unknown) => cb(d as UpdateProgressState)),
  onUpdateFinish: (cb: (s: UpdateProgressState) => void): (() => void) =>
    window.api.onUpdateFinish((d: unknown) => cb(d as UpdateProgressState)),
  onUpdateAvailable: (cb: (r: CheckResult) => void): (() => void) =>
    window.api.onUpdateAvailable((d: unknown) => cb(d as CheckResult)),
  onUpdateSource: (cb: (d: { source: UpdateSource }) => void): (() => void) =>
    window.api.onUpdateSource((d: unknown) => cb(d as { source: UpdateSource }))
}

export type UpdateSource = 'github' | 'gitcode'
export type InstallerKind = 'exe' | 'zip'

export interface AssetRefInfo {
  name: string
  url: string
  size?: number
  sha256?: string
}

/** 某一端的 Release 信息（后端归一化后） */
export interface ReleaseInfo {
  source: UpdateSource
  tag: string
  version: string
  changelog: string
  commit?: string
  prerelease: boolean
  publishedAt?: string
  pageUrl?: string
  assets: { exe?: AssetRefInfo; zip?: AssetRefInfo }
  channel: 'api' | 'atom'
}

export interface CheckResult {
  current: string
  available: boolean
  /** 较新的一端（两端都有则取版本较高者） */
  best?: ReleaseInfo
  perSource: { github: ReleaseInfo | null; gitcode: ReleaseInfo | null }
  errors: { source: UpdateSource; message: string }[]
  checkedAt: number
}

export interface UpdatePrefs {
  source: UpdateSource | null
  kind: InstallerKind | null
  remember: boolean
  backup: boolean
  lastCheckAt?: number
  lastNotifiedVersion?: string
}

/** 下载进度 / 状态（进度窗用） */
export interface UpdateProgressState {
  phase: 'idle' | 'downloading' | 'done' | 'error' | 'cancelled'
  source?: UpdateSource
  kind?: InstallerKind
  version?: string
  received: number
  total: number
  percent: number
  /** 字节/秒 */
  speed: number
  path?: string
  error?: string
}

export interface UpdateStartResult {
  ok: boolean
  cancelled?: boolean
  error?: string
  version?: string
  total?: number
  source?: UpdateSource
  kind?: InstallerKind
  pageUrl?: string
}

export interface ConfigExportResult {
  ok: boolean
  cancelled?: boolean
  error?: string
  path?: string
  counts?: { glossary: number; memory: number; apiKeyEncrypted: boolean; apiKeyIncluded: boolean }
}

export interface ConfigImportResult {
  ok: boolean
  cancelled?: boolean
  error?: string
  settingsApplied?: string[]
  glossaryAdded?: number
  glossarySkipped?: number
  memoryUpserted?: number
  backupPath?: string
  warnings?: string[]
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
