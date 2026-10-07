/**
 * 更新期窗口流程（需求 6）：
 * 开始更新 → 隐藏主窗口 → 只显示 417×202 无边框进度窗；
 * 取消 / 点叉号 → 关进度窗 → 主窗口回来。
 *
 * 为什么用 hide() 而不是销毁主窗口：视觉与"关闭"一致（任务栏里也消失），
 * 但省掉重建整个渲染层 + 重新加载 46MB 数据的时间，取消后能立刻回到原状态。
 */
import { BrowserWindow, screen } from 'electron'
import type { UpdateSource } from './types'

export interface UpdateWindowDeps {
  /** 主窗口（可能还没创建或已销毁） */
  getMain: () => BrowserWindow | null
  /** preload 脚本的绝对路径 */
  preload: string
  /** 打包后的渲染入口 index.html 绝对路径 */
  rendererIndex: string
  /** dev 模式下的渲染地址（electron-vite dev 注入） */
  devUrl?: string
  /** 进度窗被用户关掉时回调（用于取消下载 + 恢复主窗口） */
  onClosed: () => void
}

/** 进度窗尺寸。
 *
 * 设计稿 frame（63:282 / 63:316）标的是 417×202，但**它自己装不下自己的内容**：
 *  · 高度：内边距 32 + header 32 + 「请耐心等待」17 + 「下载进度」16 + 进度条 12
 *    + 元信息 16 + 「取消」按钮 43 + 各组间距 ≈ 226 > 202 → 按 202 渲染会把右下角「取消」裁掉（用户实测）；
 *  · 宽度：「正在尝试从 GitCode 下载……」在 417 里会溢出（GitCode 比 GitHub 多一个字符），用户实测标题被截断。
 * 所以取 **440×244**（宽度 +23 给标题留余量、高度 +42 吸收各机器 DPI 差异），
 * 并且**不做运行时自适应** —— 实测 `setContentSize` 的读回值滞后 1~2 轮，
 * 做「按内容改尺寸」的反馈会让窗口来回震荡（用户实测：窗口忽大忽小）。 */
export const UPDATE_WINDOW_SIZE = { width: 440, height: 244 }
export const UPDATE_WINDOW_BG = '#f9f3df'

export class UpdateWindowManager {
  private win: BrowserWindow | null = null
  private source: UpdateSource = 'github'

  constructor(private readonly deps: UpdateWindowDeps) {}

  isOpen(): boolean {
    return !!this.win && !this.win.isDestroyed()
  }

  /** 当前进度窗（用于发送进度事件） */
  window(): BrowserWindow | null {
    return this.isOpen() ? this.win : null
  }

  /** 打开时记录的主窗口位置（尺寸变化后重新居中用） */
  private mainBounds: { x: number; y: number; width: number; height: number } | null = null

  /**
   * 只在**内容装不下时把窗口变大** —— 只增不减。
   *
   * 为什么坚持「只增」：`setContentSize` 的读回值滞后 1~2 轮，一旦允许缩小，
   * 就会与滞后的测量形成来回震荡（实测窗口在 385↔420 之间反复跳，用户看到「一直变大变小」）。
   * 只增 ⇒ 单调收敛 ⇒ 数学上不可能震荡；代价只是可能多出几像素空白。
   */
  fitContent(metrics: {
    innerWidth: number
    innerHeight: number
    neededWidth: number
    neededHeight: number
  }): { ok: boolean; resized?: boolean } {
    const win = this.window()
    if (!win) return { ok: false }
    const [cw, ch] = win.getContentSize()
    const growW = Math.max(0, Math.ceil(metrics.neededWidth - metrics.innerWidth))
    const growH = Math.max(0, Math.ceil(metrics.neededHeight - metrics.innerHeight))
    if (growW <= 0 && growH <= 0) return { ok: true, resized: false }
    // 关键：Windows 上 `resizable: false` 的窗口会**忽略 setContentSize**（返回成功但尺寸不变）。
    // 所以改尺寸前后各切一次可缩放状态；改完立刻锁回，用户依然拖不动这个窗。
    win.setResizable(true)
    win.setContentSize(cw + growW + 4, ch + growH + 4)
    win.setResizable(false)
    this.recenter()
    return { ok: true, resized: true }
  }

  /** 按打开时记录的主窗口位置重新居中（只改位置，不改尺寸） */
  recenter(): void {
    const win = this.window()
    if (!win || !this.mainBounds) return
    const b = win.getBounds()
    const pos = centerOnSize(this.mainBounds, b.width, b.height)
    win.setBounds({ x: pos.x, y: pos.y, width: b.width, height: b.height })
  }

  /** 打开进度窗：先隐藏主窗口，再创建进度窗（居中于主窗口） */
  open(source: UpdateSource): void {
    this.source = source

    const main = this.deps.getMain()
    const alive = !!main && !main.isDestroyed()
    const centered = alive && main ? centerOn(main.getBounds()) : null
    if (alive && main) this.mainBounds = main.getBounds()
    if (alive && main) main.hide()

    if (this.isOpen()) {
      this.sendSource()
      return
    }

    const win = new BrowserWindow({
      width: UPDATE_WINDOW_SIZE.width,
      height: UPDATE_WINDOW_SIZE.height,
      ...(centered ?? {}),
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      frame: false,
      show: false,
      backgroundColor: UPDATE_WINDOW_BG,
      title: 'Translator MC 更新',
      webPreferences: {
        preload: this.deps.preload,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    win.on('ready-to-show', () => win.show())
    win.on('closed', () => {
      this.win = null
      this.deps.onClosed()
    })

    // 创建后再按**实际**窗口尺寸居中：不同 DPI / 显示器下实际尺寸会与请求值不同，
    // 用请求值算会偏（实测偏 24~39px）。只校正一次位置、不碰尺寸，不会震荡。
    if (main && !main.isDestroyed()) {
      const actual = win.getBounds()
      const pos = centerOnSize(main.getBounds(), actual.width, actual.height)
      win.setBounds({ x: pos.x, y: pos.y, width: actual.width, height: actual.height })
    }

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    const search = `window=update&source=${this.source}`
    if (this.deps.devUrl) {
      void win.loadURL(`${this.deps.devUrl}${this.deps.devUrl.includes('?') ? '&' : '?'}${search}`)
    } else {
      void win.loadFile(this.deps.rendererIndex, { search })
    }

    this.win = win
  }

  /** 关进度窗 + 恢复主窗口（取消、失败、完成都走这里） */
  close(): void {
    if (this.isOpen()) {
      const win = this.win
      this.win = null
      win?.destroy()
    }
    this.showMain()
  }

  /** 只关进度窗，不动主窗口（例如下载完成后先弹系统对话框） */
  closeOnly(): void {
    if (this.isOpen()) {
      const win = this.win
      this.win = null
      win?.destroy()
    }
  }

  showMain(): void {
    const main = this.deps.getMain()
    if (main && !main.isDestroyed()) {
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
    }
  }

  /** 给进度窗发消息 */
  send(channel: string, payload?: unknown): void {
    const win = this.window()
    if (win && !win.webContents.isDestroyed()) win.webContents.send(channel, payload)
  }

  /** 切换来源（重试换源时更新标题文案） */
  setSource(source: UpdateSource): void {
    this.source = source
    this.sendSource()
  }

  private sendSource(): void {
    this.send('update:source', { source: this.source })
  }
}

/** 把进度窗摆到主窗口正中心（再夹到当前显示器工作区内，避免主窗口贴边时跑出屏幕） */
function centerOn(bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return centerOnSize(bounds, UPDATE_WINDOW_SIZE.width, UPDATE_WINDOW_SIZE.height)
}

/** 指定尺寸时同样居中 */
function centerOnSize(
  bounds: { x: number; y: number; width: number; height: number },
  width: number,
  height: number
): { x: number; y: number } {
  let x = Math.round(bounds.x + (bounds.width - width) / 2)
  let y = Math.round(bounds.y + (bounds.height - height) / 2)
  try {
    const wa = screen.getDisplayMatching(bounds).workArea
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - width)
    y = Math.min(Math.max(y, wa.y), wa.y + wa.height - height)
  } catch {
    /* 取不到显示器信息就用未夹取的位置 */
  }
  return { x, y }
}
