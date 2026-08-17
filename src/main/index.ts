import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc'
import { logger } from './logger'
import { runSelfTest } from './selftest'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Translator MC',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
