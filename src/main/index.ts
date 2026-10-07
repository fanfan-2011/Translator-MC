import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc'
import { logger } from './logger'
import { runSelfTest } from './selftest'
import { startAutoCheck, type AutoCheckHandle } from './update/check'
import { initUpdateWindows, currentVersionForUpdate, getDownloader, getLiveState, setLiveState } from './update/runtime'
import { loadUpdatePrefs } from './update/prefs'

/** 主窗口引用（更新流程要隐藏/恢复它，见 main/update/windows.ts） */
let mainWindow: BrowserWindow | null = null
let autoCheck: AutoCheckHandle | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Translator MC',
    // 自绘顶栏：设计稿 6:53 的顶栏 + 36:121 三键（见 design/UI-SPEC.md）
    frame: false,
    backgroundColor: '#e6e6e6',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('ready-to-show', () => win.show())

  // 最大化状态变化（含系统快捷键 / 双击）同步给渲染层，保证三键图标一致
  const pushWinState = (): void => {
    if (!win.isDestroyed()) win.webContents.send('window:state', win.isMaximized())
  }
  win.on('maximize', pushWinState)
  win.on('unmaximize', pushWinState)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  try {
    await initDatabase()
  } catch (e) {
    logger.error(`数据库初始化失败: ${e}`)
  }
  registerIpcHandlers()

  // Headless full-pipeline self-test mode: `electron . --selftest`
  if (process.argv.includes('--selftest')) {
    const ok = await runSelfTest()
    app.exit(ok ? 0 : 1)
    return
  }

  createWindow()

  // 更新：进度窗流程（需求 6）
  initUpdateWindows({
    getMain: () => mainWindow,
    preload: join(__dirname, '../preload/index.js'),
    rendererIndex: join(__dirname, '../renderer/index.html'),
    devUrl: process.env['ELECTRON_RENDERER_URL'],
    onClosed: () => {
      // 进度窗被销毁时：若还在下载就取消（分片保留，下次可续传）
      if (getLiveState().phase === 'downloading') {
        getDownloader().cancel()
        setLiveState({ phase: 'cancelled' })
      }
    }
  })

  // 更新：启动即检查 + 每 10 分钟一次（需求 1）；发现新版本推给主窗口刷新左下角卡片
  autoCheck = startAutoCheck({
    current: currentVersionForUpdate(),
    // 两端版本相同时优先用户上次用过的来源（见 prefs.ts 的 lastGoodSource）
    preferSource: () => loadUpdatePrefs().lastGoodSource ?? null,
    onResult: (r) => {
      for (const e of r.errors) logger.info(`自动更新检查失败（已忽略）: ${e.source} — ${e.message}`)
    },
    onNewVersion: (r) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:available', r)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  autoCheck?.stop()
  closeDatabase()
})
