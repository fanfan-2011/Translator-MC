/**
 * 更新运行时单例：下载器与进度窗口管理器集中在这里创建，
 * 主进程入口（main/index.ts）注入窗口依赖，IPC 层用 getter 取。
 * 还存放「当前下载状态」快照 —— 进度窗刚打开时可能还没渲染完，
 * 早期进度事件会丢，所以渲染层挂载后主动拉一次（update:get-state）。
 */
import { app } from 'electron'
import { join } from 'path'
import { Downloader } from './downloader'
import { UpdateWindowManager, type UpdateWindowDeps } from './windows'
import type { InstallerKind, UpdateSource } from './types'

let windows: UpdateWindowManager | null = null
let downloader: Downloader | null = null

/** 下载与断点分片的根目录（不写 %TEMP%，避免被系统清理后无法续传） */
export function updateRoot(): string {
  return join(app.getPath('userData'), 'updates')
}

/**
 * 「检查更新」用来比较的当前版本。
 *
 * 开发期可以设环境变量 `TSM_FAKE_CURRENT_VERSION=1.0.0` 把本机伪装成旧版本 ——
 * 这是**在 2.1.0 正式发布之前、唯一能看到整条更新流程的办法**（否则本地版本与远端
 * Release 都是 2.0.0，检查结果永远是「已是最新」）。
 * **打包后的正式版忽略这个变量**（双重保险：只在未打包时生效），用户不可能被影响。
 */
export function currentVersionForUpdate(): string {
  const fake = process.env.TSM_FAKE_CURRENT_VERSION
  if (fake && !app.isPackaged) return fake
  return app.getVersion()
}

/** 导入配置前的自动备份目录 */
export function backupRoot(): string {
  return join(app.getPath('userData'), 'backups')
}

export function getDownloader(): Downloader {
  if (!downloader) downloader = new Downloader(updateRoot())
  return downloader
}

export function initUpdateWindows(deps: UpdateWindowDeps): UpdateWindowManager {
  windows = new UpdateWindowManager(deps)
  return windows
}

export function getUpdateWindows(): UpdateWindowManager | null {
  return windows
}

export interface UpdateLiveState {
  phase: 'idle' | 'downloading' | 'done' | 'error' | 'cancelled'
  source?: UpdateSource
  kind?: InstallerKind
  version?: string
  received: number
  total: number
  percent: number
  speed: number
  path?: string
  error?: string
  /** Release 网页地址（失败时「打开下载页」用） */
  pageUrl?: string
}

let live: UpdateLiveState = { phase: 'idle', received: 0, total: 0, percent: 0, speed: 0 }

export function setLiveState(patch: Partial<UpdateLiveState>): UpdateLiveState {
  live = { ...live, ...patch }
  return live
}

export function getLiveState(): UpdateLiveState {
  return live
}
