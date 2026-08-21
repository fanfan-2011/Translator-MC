import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { dirname, join } from 'path'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import * as db from './db/database'
import { importFiles, previewPackage } from './package/importer'
import { translateProject } from './translation/service'
import { pauseTask, resumeTask, cancelTask } from './translation/task-control'
import { reviewProject } from './quality/reviewer'
import { exportPreCheck, exportProject } from './export/exporter'
import { llmListModels } from './llm/provider'
import { encryptSecret, decryptSecret } from './security'
import { logger } from './logger'
import { DEFAULT_LLM_CONFIG, type AppSettings, type ExportOptions, type LLMConfig } from '@shared/types'

function loadLlmConfig(): LLMConfig {
  const raw = db.getSetting('llm_config')
  if (!raw) return { ...DEFAULT_LLM_CONFIG }
  try {
    const parsed = JSON.parse(raw) as LLMConfig
    parsed.apiKey = decryptSecret(parsed.apiKey || '')
    return { ...DEFAULT_LLM_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_LLM_CONFIG }
  }
}

function saveLlmConfig(config: LLMConfig): void {
  const toStore = { ...config, apiKey: encryptSecret(config.apiKey || '') }
  db.setSetting('llm_config', JSON.stringify(toStore))
}

// ---------- 帮助文档（.tmhelp 混淆容器） ----------
const TMHELP_MAGIC = 'TMHP'
const TMHELP_KEY = 0x5a

interface TmhelpFile {
  path: string
  data: Buffer
}

function parseTmhelp(buf: Buffer): TmhelpFile[] {
  if (buf.toString('ascii', 0, 4) !== TMHELP_MAGIC) throw new Error('不是有效的帮助文件格式')
  const version = buf[4]
  if (version !== 1) throw new Error(`不支持的帮助文件版本: ${version}`)
  const count = buf.readUInt16LE(5)
  let off = 7
  const files: TmhelpFile[] = []
  for (let i = 0; i < count; i++) {
    const plen = buf.readUInt16LE(off)
    off += 2
    const p = buf.toString('utf8', off, off + plen)
    off += plen
    const dlen = buf.readUInt32LE(off)
    off += 4
    const enc = Buffer.from(buf.subarray(off, off + dlen))
    off += dlen
    for (let j = 0; j < enc.length; j++) enc[j] ^= TMHELP_KEY
    files.push({ path: p, data: enc })
  }
  return files
}

export function registerIpcHandlers(): void {
  // ---------- Projects ----------
  ipcMain.handle('project:list', () => db.listProjects())
  ipcMain.handle('project:get', (_e, id: string) => db.getProject(id))
  ipcMain.handle('project:create', (_e, name: string) => db.createProject(name))
  ipcMain.handle('project:rename', (_e, id: string, name: string) => db.renameProject(id, name))
  ipcMain.handle('project:delete', (_e, id: string) => db.deleteProject(id))

  // ---------- Import ----------
  ipcMain.handle('import:select', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '内容包 (.jar / .zip)', extensions: ['jar', 'zip'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('import:selectDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('import:preview', (_e, sourcePath: string, hint?: string, targetCode?: string) =>
    previewPackage(sourcePath, hint as never, targetCode)
  )
  ipcMain.handle('import:files', (_e, sourcePaths: string[], projectId?: string, hint?: string, targetCode?: string) =>
    importFiles(sourcePaths, projectId, hint as never, targetCode)
  )

  // ---------- Packages ----------
  ipcMain.handle('packages:list', (_e, projectId: string) => db.listPackages(projectId))

  // ---------- Entries ----------
  ipcMain.handle('entries:list', (_e, projectId: string) => db.listEntries(projectId))
  ipcMain.handle('entries:updateTarget', (_e, id: string, target: string, status: string) => {
    db.updateEntryTarget(id, target, status as never)
    db.addHistory(id, 'human', target)
  })
  ipcMain.handle('entries:setSelected', (_e, id: string, selected: boolean) => db.updateEntrySelected(id, selected))
  ipcMain.handle('entries:setSelectedMany', (_e, ids: string[], selected: boolean) => {
    for (const id of ids) db.updateEntrySelected(id, selected)
  })
  ipcMain.handle('entries:clearTarget', (_e, id: string) => db.clearEntryTarget(id))
  ipcMain.handle('entries:clearAll', (_e, projectId: string) => db.clearAllTargets(projectId))

  // ---------- Glossary ----------
  ipcMain.handle('glossary:list', () => db.listGlossary())
  ipcMain.handle('glossary:add', (_e, g) => db.insertGlossary(g))
  ipcMain.handle('glossary:update', (_e, id: string, patch) => db.updateGlossary(id, patch))
  ipcMain.handle('glossary:delete', (_e, id: string) => db.deleteGlossary(id))

  // ---------- Translation Memory ----------
  ipcMain.handle('memory:list', () => db.listMemory())
  ipcMain.handle('memory:deleteMany', (_e, ids: string[]) => db.deleteMemoryMany(ids))

  // ---------- History ----------
  ipcMain.handle('history:list', (_e, entryId: string) => db.listHistory(entryId))
  ipcMain.handle('history:listAll', (_e, projectId: string) => db.listAllHistory(projectId))
  ipcMain.handle('history:deleteMany', (_e, ids: string[]) => db.deleteHistoryMany(ids))

  // ---------- Issues ----------
  ipcMain.handle('issues:list', (_e, projectId: string) => db.listIssues(projectId))
  ipcMain.handle('issues:setResolved', (_e, id: string, resolved: boolean) => db.setIssueResolved(id, resolved))

  // ---------- Settings ----------
  ipcMain.handle('settings:get', () => db.loadAppSettings())
  ipcMain.handle('settings:set', (_e, s: AppSettings) => db.saveAppSettings(s))

  // ---------- LLM ----------
  ipcMain.handle('llm:getConfig', () => loadLlmConfig())
  ipcMain.handle('llm:setConfig', (_e, config: LLMConfig) => saveLlmConfig(config))
  ipcMain.handle('llm:listModels', (_e, config: LLMConfig) => llmListModels(config))

  // ---------- Translation ----------
  ipcMain.handle('translate:start', (event, projectId: string, options) => {
    const config = loadLlmConfig()
    const sender = event.sender
    void translateProject(projectId, config, options ?? {}, (p) => sender.send('translate:progress', p))
      .then((r) => sender.send('translate:done', r))
      .catch((e) => sender.send('translate:done', { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return { ok: true }
  })
  ipcMain.handle('translate:pause', (_e, taskId: string) => pauseTask(taskId))
  ipcMain.handle('translate:resume', (_e, taskId: string) => resumeTask(taskId))
  ipcMain.handle('translate:cancel', (_e, taskId: string) => cancelTask(taskId))

  // ---------- Review ----------
  ipcMain.handle('review:start', (event, projectId: string) => {
    const config = loadLlmConfig()
    const sender = event.sender
    void reviewProject(projectId, config, (p) => sender.send('review:progress', p))
      .then((r) => sender.send('review:done', r))
      .catch((e) => sender.send('review:done', { ok: false, error: e instanceof Error ? e.message : String(e) }))
    return { ok: true }
  })
  ipcMain.handle('review:pause', (_e, taskId: string) => pauseTask(taskId))
  ipcMain.handle('review:resume', (_e, taskId: string) => resumeTask(taskId))
  ipcMain.handle('review:cancel', (_e, taskId: string) => cancelTask(taskId))

  // ---------- Export ----------
  ipcMain.handle('export:preCheck', (_e, projectId: string) => exportPreCheck(projectId))
  ipcMain.handle('export:save', (_e, projectId: string, options: ExportOptions, outputPath?: string) =>
    exportProject(projectId, options, outputPath)
  )
  ipcMain.handle('export:choosePath', async (_e, defaultName: string, ext: string) => {
    const r = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: ext === 'jar' ? 'Jar 文件' : 'Zip 文件', extensions: [ext] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return r.canceled ? null : r.filePath
  })

  // ---------- Logs ----------
  ipcMain.handle('log:list', () => logger.getLogs())
  ipcMain.handle('log:clear', () => logger.clear())

  // ---------- Help ----------
  ipcMain.handle('help:open', async (event) => {
    try {
      const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
      const tmhelpPath = join(base, 'help', 'help.tmhelp')
      const buf = await readFile(tmhelpPath)
      const files = parseTmhelp(buf)

      // 解包到临时目录
      const dir = await mkdtemp(join(app.getPath('temp'), 'tm-help-'))
      let entry = ''
      for (const f of files) {
        const full = join(dir, f.path)
        await mkdir(dirname(full), { recursive: true })
        await writeFile(full, f.data)
        if (f.path === 'index.html') entry = full
      }
      if (!entry) throw new Error('帮助文件缺少 index.html')

      // 应用内弹窗加载
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const win = new BrowserWindow({
        width: 1080,
        height: 780,
        minWidth: 800,
        minHeight: 600,
        title: 'Translator MC 帮助',
        autoHideMenuBar: true,
        parent,
        modal: true,
        show: false,
        webPreferences: { sandbox: true }
      })
      win.once('ready-to-show', () => win.show())
      win.on('closed', () => {
        void rm(dir, { recursive: true, force: true }).catch(() => {})
      })
      await win.loadFile(entry)
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`打开帮助文档失败: ${msg}`)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('ping', () => 'pong')
  logger.info('IPC handlers registered')
}
