import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

function on<T>(channel: string, cb: (data: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  // projects
  listProjects: (): Promise<unknown> => ipcRenderer.invoke('project:list'),
  getProject: (id: string): Promise<unknown> => ipcRenderer.invoke('project:get', id),
  createProject: (name: string): Promise<unknown> => ipcRenderer.invoke('project:create', name),
  renameProject: (id: string, name: string): Promise<unknown> => ipcRenderer.invoke('project:rename', id, name),
  deleteProject: (id: string): Promise<unknown> => ipcRenderer.invoke('project:delete', id),

  // import
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('import:select'),
  selectDir: (): Promise<string[]> => ipcRenderer.invoke('import:selectDir'),
  previewPackage: (sourcePath: string, hint?: string): Promise<unknown> =>
    ipcRenderer.invoke('import:preview', sourcePath, hint),
  importFiles: (sourcePaths: string[], projectId?: string, hint?: string): Promise<unknown> =>
    ipcRenderer.invoke('import:files', sourcePaths, projectId, hint),

  // packages
  listPackages: (projectId: string): Promise<unknown> => ipcRenderer.invoke('packages:list', projectId),

  // entries
  listEntries: (projectId: string): Promise<unknown> => ipcRenderer.invoke('entries:list', projectId),
  updateEntryTarget: (id: string, target: string, status: string): Promise<unknown> =>
    ipcRenderer.invoke('entries:updateTarget', id, target, status),
  setSelected: (id: string, selected: boolean): Promise<unknown> =>
    ipcRenderer.invoke('entries:setSelected', id, selected),
  setSelectedMany: (ids: string[], selected: boolean): Promise<unknown> =>
    ipcRenderer.invoke('entries:setSelectedMany', ids, selected),
  clearTarget: (id: string): Promise<unknown> => ipcRenderer.invoke('entries:clearTarget', id),
  clearAllTargets: (projectId: string): Promise<unknown> => ipcRenderer.invoke('entries:clearAll', projectId),

  // glossary
  listGlossary: (): Promise<unknown> => ipcRenderer.invoke('glossary:list'),
  addGlossary: (g: unknown): Promise<unknown> => ipcRenderer.invoke('glossary:add', g),
  updateGlossary: (id: string, patch: unknown): Promise<unknown> => ipcRenderer.invoke('glossary:update', id, patch),
  deleteGlossary: (id: string): Promise<unknown> => ipcRenderer.invoke('glossary:delete', id),

  // translation memory
  listMemory: (): Promise<unknown> => ipcRenderer.invoke('memory:list'),
  deleteMemoryMany: (ids: string[]): Promise<unknown> => ipcRenderer.invoke('memory:deleteMany', ids),

  // history
  listHistory: (entryId: string): Promise<unknown> => ipcRenderer.invoke('history:list', entryId),
  listAllHistory: (projectId: string): Promise<unknown> => ipcRenderer.invoke('history:listAll', projectId),
  deleteHistoryMany: (ids: string[]): Promise<unknown> => ipcRenderer.invoke('history:deleteMany', ids),

  // issues
  listIssues: (projectId: string): Promise<unknown> => ipcRenderer.invoke('issues:list', projectId),
  setIssueResolved: (id: string, resolved: boolean): Promise<unknown> =>
    ipcRenderer.invoke('issues:setResolved', id, resolved),

  // settings
  getSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
  setSettings: (s: unknown): Promise<unknown> => ipcRenderer.invoke('settings:set', s),

  // llm
  getLlmConfig: (): Promise<unknown> => ipcRenderer.invoke('llm:getConfig'),
  setLlmConfig: (config: unknown): Promise<unknown> => ipcRenderer.invoke('llm:setConfig', config),
  listModels: (config: unknown): Promise<unknown> => ipcRenderer.invoke('llm:listModels', config),

  // translation
  startTranslate: (projectId: string, options: unknown): Promise<unknown> =>
    ipcRenderer.invoke('translate:start', projectId, options),
  pauseTranslate: (taskId: string): Promise<unknown> => ipcRenderer.invoke('translate:pause', taskId),
  resumeTranslate: (taskId: string): Promise<unknown> => ipcRenderer.invoke('translate:resume', taskId),
  cancelTranslate: (taskId: string): Promise<unknown> => ipcRenderer.invoke('translate:cancel', taskId),
  onTranslateProgress: (cb: (data: unknown) => void): (() => void) => on('translate:progress', cb),
  onTranslateDone: (cb: (data: unknown) => void): (() => void) => on('translate:done', cb),

  // review
  startReview: (projectId: string): Promise<unknown> => ipcRenderer.invoke('review:start', projectId),
  pauseReview: (taskId: string): Promise<unknown> => ipcRenderer.invoke('review:pause', taskId),
  resumeReview: (taskId: string): Promise<unknown> => ipcRenderer.invoke('review:resume', taskId),
  cancelReview: (taskId: string): Promise<unknown> => ipcRenderer.invoke('review:cancel', taskId),
  onReviewProgress: (cb: (data: unknown) => void): (() => void) => on('review:progress', cb),
  onReviewDone: (cb: (data: unknown) => void): (() => void) => on('review:done', cb),

  // export
  exportPreCheck: (projectId: string): Promise<unknown> => ipcRenderer.invoke('export:preCheck', projectId),
  exportSave: (projectId: string, options: unknown, outputPath?: string): Promise<unknown> =>
    ipcRenderer.invoke('export:save', projectId, options, outputPath),
  chooseExportPath: (defaultName: string, ext: string): Promise<string | null> =>
    ipcRenderer.invoke('export:choosePath', defaultName, ext),

  // logs
  getLogs: (): Promise<unknown> => ipcRenderer.invoke('log:list'),
  clearLogs: (): Promise<unknown> => ipcRenderer.invoke('log:clear'),

  // help
  openHelp: (): Promise<unknown> => ipcRenderer.invoke('help:open'),

  ping: (): Promise<string> => ipcRenderer.invoke('ping')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
