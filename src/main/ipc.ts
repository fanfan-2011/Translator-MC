import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
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
import { checkForUpdate } from './update/check'
import { fetchRelease, probeSize } from './update/sources'
import { exportConfigTo, importConfigFrom } from './update/config-file'
import { loadUpdatePrefs, saveUpdatePrefs, type UpdatePrefs } from './update/prefs'
import { backupRoot, currentVersionForUpdate, getDownloader, getLiveState, getUpdateWindows, setLiveState, updateRoot } from './update/runtime'
import type { DownloadProgress } from './update/downloader'
import type { InstallerKind, ReleaseInfo, UpdateSource } from './update/types'

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
  ipcMain.handle('history:deleteMany', (_e, ids: string[], projectId?: string) =>
    db.deleteHistoryMany(ids, projectId)
  )

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

  // ---------- 窗口控制（frameless 顶栏三键，见设计稿 36:121） ----------
  ipcMain.handle(
    'window:state',
    (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  )
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // ---------- 更新与用户配置（v2.1.0；网络失败一律静默） ----------

  /** 判「过慢」的阈值：平均低于 100KB/s 且已下 15 秒 → 换另一端（128MB 包在 100KB/s 下要 20 分钟） */
  const SLOW_SPEED_BPS = 100 * 1024
  const SLOW_FOR_MS = 15_000

  ipcMain.handle('update:check', async () => {
    const result = await checkForUpdate(currentVersionForUpdate(), {
      preferSource: loadUpdatePrefs().lastGoodSource ?? null
    })
    for (const e of result.errors) logger.info(`更新检查失败（已忽略）: ${e.source} — ${e.message}`)
    saveUpdatePrefs({ lastCheckAt: result.checkedAt })
    return result
  })

  ipcMain.handle('update:get-prefs', () => loadUpdatePrefs())
  ipcMain.handle('update:set-prefs', (_e, patch: Partial<UpdatePrefs>) => saveUpdatePrefs(patch ?? {}))
  /** 进度窗刚挂载时拉一次状态（早期进度事件可能已经发过） */
  ipcMain.handle('update:get-state', () => getLiveState())

  /** 进度窗：内容装不下时按需变大（只增不减，见 windows.ts 的 fitContent 注释） */
  ipcMain.handle(
    'update:fit-window',
    (_e, metrics: { innerWidth: number; innerHeight: number; neededWidth: number; neededHeight: number }) =>
      getUpdateWindows()?.fitContent(metrics) ?? { ok: false }
  )

  ipcMain.handle(
    'update:start',
    async (
      event,
      req: { source?: UpdateSource; kind?: InstallerKind; backup?: boolean; remember?: boolean }
    ) => {
      const source: UpdateSource = req?.source === 'gitcode' ? 'gitcode' : 'github'
      const kind: InstallerKind = req?.kind === 'zip' ? 'zip' : 'exe'
      const wm = getUpdateWindows()
      if (!wm) return { ok: false, error: '更新模块未初始化' }

      // 记住本次设置（需求 4）
      saveUpdatePrefs(
        req?.remember === false ? { remember: false, backup: req?.backup === true } : { source, kind, remember: true, backup: req?.backup === true }
      )

      const win = BrowserWindow.fromWebContents(event.sender)
      const stamp = new Date().toISOString().slice(0, 10)
      const saveOpts = {
        title: '导出用户配置（更新前备份）',
        defaultPath: `Translator-MC-config-${stamp}.json`,
        filters: [{ name: 'Translator MC 配置', extensions: ['json'] }]
      }

      // 1) 可选：更新前导出用户配置（需求 4，用系统资源管理器选位置）
      if (req?.backup) {
        const picked = win ? await dialog.showSaveDialog(win, saveOpts) : await dialog.showSaveDialog(saveOpts)
        if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true }
        try {
          exportConfigTo(picked.filePath, app.getVersion())
        } catch (e) {
          return { ok: false, error: `导出配置失败：${e instanceof Error ? e.message : String(e)}` }
        }
      }

      // 2) 取该来源的版本与资产
      let release: ReleaseInfo
      try {
        release = await fetchRelease(source)
      } catch (e) {
        return { ok: false, error: `获取更新信息失败：${e instanceof Error ? e.message : String(e)}` }
      }
      const asset = release.assets[kind]
      if (!asset) return { ok: false, error: `该来源没有提供 ${kind} 安装包` }
      const total = asset.size ?? (await probeSize(asset.url)) ?? 0

      // 3) 隐藏主窗、只留进度窗（需求 6）
      setLiveState({
        phase: 'downloading',
        source,
        kind,
        version: release.version,
        received: 0,
        total,
        percent: 0,
        speed: 0,
        path: undefined,
        error: undefined,
        pageUrl: release.pageUrl
      })
      wm.open(source)
      wm.send('update:progress', getLiveState())

      // 4) 下载（异步；进度推给进度窗）
      const dl = getDownloader()
      const task = {
        source,
        kind,
        version: release.version,
        name: asset.name,
        url: asset.url,
        total,
        sha256: asset.sha256
      }
      // 记住「用户实际用了哪个源」：两端版本相同时下次优先它（见 prefs.lastGoodSource）
      saveUpdatePrefs({ lastGoodSource: source })

      void (async () => {
        // 进度回调顺带监测「过慢」：某些网络下 GitHub 只有 ~0.1MB/s 还会断连，
        // 一直等下去等于卡死，久慢就换另一端重来（只换一次）。
        // 用「本次尝试的平均速度」判定，不用平滑瞬时速度 —— 后者网络一抖动就把计时清零，
        // 实测要 50 秒才触发，太慢。
        let attemptStart = Date.now()
        let attemptBaseBytes = 0
        let abortForSlow = false
        const onProgress = (p: DownloadProgress): void => {
          const elapsed = Date.now() - attemptStart
          const avg = ((p.received - attemptBaseBytes) * 1000) / Math.max(1, elapsed)
          if (!abortForSlow && elapsed >= SLOW_FOR_MS && p.received > 0 && avg < SLOW_SPEED_BPS) {
            abortForSlow = true
            logger.info(
              `下载过慢（平均 ${Math.round(avg / 1024)}KB/s，持续 ${Math.round(elapsed / 1000)} 秒），换另一端重试`
            )
            dl.cancel()
          }
          wm.send('update:progress', setLiveState({ ...p }))
        }

        /** 换源：取另一端的**同一版本**资产；版本不同就不换（别把用户带到另一个版本去） */
        const alternate = async (
          src: UpdateSource
        ): Promise<{ url: string; size?: number; sha256?: string; pageUrl?: string } | null> => {
          try {
            const rel = await fetchRelease(src)
            if (rel.version !== release.version) return null
            const a = rel.assets[kind]
            if (!a) return null
            const size = a.size ?? (await probeSize(a.url)) ?? 0
            return { url: a.url, size, sha256: a.sha256, pageUrl: rel.pageUrl }
          } catch (e) {
            logger.warn(`换源到 ${src} 失败：${e instanceof Error ? e.message : String(e)}`)
            return null
          }
        }

        let curSource: UpdateSource = source
        let res = await dl.start(task, onProgress)

        // 失败、或因过慢被我们主动中断 → 自动换另一端再试一次
        if (res.state === 'error' || (abortForSlow && res.state === 'cancelled')) {
          const other: UpdateSource = curSource === 'github' ? 'gitcode' : 'github'
          const alt = await alternate(other)
          if (alt) {
            logger.info(`改用 ${other} 重试下载`)
            // 换源要丢弃分片：两端虽同名同大小，但不保证逐字节相同，混着写会得到坏文件
            dl.clearPart({ version: task.version, name: task.name })
            curSource = other
            // 重置过慢判定：新一轮尝试从零算平均速度
            attemptStart = Date.now()
            attemptBaseBytes = 0
            abortForSlow = false
            setLiveState({ source: other, pageUrl: alt.pageUrl, error: undefined, received: 0, percent: 0, speed: 0 })
            wm.setSource(other)
            res = await dl.start(
              {
                source: other,
                kind,
                version: release.version,
                name: task.name,
                url: alt.url,
                total: alt.size,
                sha256: alt.sha256
              },
              onProgress
            )
          }
        }

        if (res.state === 'done') {
          wm.send('update:finish', setLiveState({ phase: 'done', path: res.path, received: res.bytes ?? total, percent: 100 }))
          // 需求 7：exe → 打开安装包；zip → 打开该压缩包
          if (res.path) {
            let openErr = ''
            try {
              openErr = await shell.openPath(res.path)
              if (openErr) logger.error(`打开安装包失败: ${openErr}`)
            } catch (e) {
              openErr = String(e)
              logger.error(`打开安装包异常: ${e}`)
            }
            // 用户 2026-10-06 裁决：安装包一打开就**直接退出应用**，后面交给安装程序。
            // zip 同理：便携包要覆盖安装目录，应用还在跑会锁住文件导致解压失败。
            // 所以这里绝不能 showMain() 回主界面（那是「覆盖安装时自己锁自己」）。
            if (!openErr) {
              await new Promise((r) => setTimeout(r, 900))
              app.quit()
              return
            }
            logger.warn('安装包打开失败，保留主界面让用户手动打开')
          }
          setTimeout(() => {
            wm.close()
          }, 1200)
        } else if (res.state === 'cancelled') {
          // 用户主动取消 → 关进度窗、回主界面（需求 6）
          wm.send('update:finish', setLiveState({ phase: 'cancelled' }))
          wm.close()
        } else {
          // 失败：**不要关窗**！把「重试 / 打开下载页 / 打开文件夹」三条出路留给用户（需求 D）。
          // 关掉的话用户只剩一句错误信息，无处可去。
          wm.send('update:finish', setLiveState({ phase: 'error', error: res.error }))
        }
      })()

      return { ok: true, version: release.version, total, source, kind, pageUrl: release.pageUrl }
    }
  )

  /** 取消下载并回到主界面（需求 6；分片保留供下次续传） */
  ipcMain.handle('update:cancel', () => {
    getDownloader().cancel()
    setLiveState({ phase: 'cancelled' })
    getUpdateWindows()?.close()
    return { ok: true }
  })

  /** 只关进度窗（例如用户点叉号，取消逻辑由渲染层先调 update:cancel） */
  ipcMain.handle('update:close-window', () => {
    getUpdateWindows()?.close()
    return { ok: true }
  })

  /**
   * 失败出路①：打开 Release 下载页，用户可手动下载。
   * 网络环境千奇百怪，任何自动流程都可能卡住 —— 给用户一条自己能走通的路。
   */
  ipcMain.handle('update:open-page', async () => {
    const url = getLiveState().pageUrl
    if (!url) return { ok: false, error: '没有可打开的下载页' }
    await shell.openExternal(url)
    return { ok: true }
  })

  /** 失败出路②：打开下载目录（能看到已下载 / 下载到一半的文件，可手动拷走） */
  ipcMain.handle('update:open-folder', async () => {
    const live = getLiveState()
    const dir = live.version ? join(updateRoot(), live.version) : updateRoot()
    await mkdir(dir, { recursive: true })
    const err = await shell.openPath(dir)
    return err ? { ok: false, error: err } : { ok: true }
  })

  // ---------- 用户配置导出 / 导入（需求 4、5） ----------
  ipcMain.handle('config:export', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const stamp = new Date().toISOString().slice(0, 10)
    const opts = {
      title: '导出用户配置',
      defaultPath: `Translator-MC-config-${stamp}.json`,
      filters: [{ name: 'Translator MC 配置', extensions: ['json'] }]
    }
    const picked = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true }
    try {
      const snapshot = exportConfigTo(picked.filePath, app.getVersion())
      return { ok: true, path: picked.filePath, counts: snapshot.counts }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('config:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = {
      title: '导入用户配置',
      properties: ['openFile' as const],
      filters: [{ name: 'Translator MC 配置', extensions: ['json'] }]
    }
    const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true }
    return importConfigFrom(picked.filePaths[0], { backupDir: backupRoot(), appVersion: app.getVersion() })
  })

  ipcMain.handle('ping', () => 'pong')
  logger.info('IPC handlers registered')
}
