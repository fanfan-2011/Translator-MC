/**
 * 更新偏好（需求 4 的「记住本次设置」）+ 自动检查时间戳。
 * 存 DB settings 表的 `update_prefs` 键（JSON），与项目既有做法一致。
 */
import { getSetting, setSetting } from '../db/database'
import type { InstallerKind, UpdateSource } from './types'

export const UPDATE_PREFS_KEY = 'update_prefs'

export interface UpdatePrefs {
  /** 记住的下载源；null = 未记住 */
  source: UpdateSource | null
  /** 记住的安装包类型；null = 未记住 */
  kind: InstallerKind | null
  /** 「记住本次设置」是否勾选（未勾选时下次不沿用上面的选择） */
  remember: boolean
  /** 「备份用户配置文件」是否勾选（默认不勾，与设计稿未选中态一致） */
  backup: boolean
  /** 上次检查完成时间（ms） */
  lastCheckAt?: number
  /** 上次提示过的版本，避免同一版本反复打扰 */
  lastNotifiedVersion?: string
  /**
   * 用户上次**实际发起过下载**的来源。
   * 两端版本相同时优先选它 —— 实测国内 GitHub 只有 0.1MB/s 还会断连，默认别再往那儿引。
   */
  lastGoodSource?: UpdateSource | null
}

export const DEFAULT_UPDATE_PREFS: UpdatePrefs = {
  source: null,
  kind: null,
  remember: true,
  backup: false
}

export function loadUpdatePrefs(): UpdatePrefs {
  const raw = getSetting(UPDATE_PREFS_KEY)
  if (!raw) return { ...DEFAULT_UPDATE_PREFS }
  try {
    const parsed = JSON.parse(raw) as Partial<UpdatePrefs>
    return {
      ...DEFAULT_UPDATE_PREFS,
      ...parsed,
      source: parsed.source === 'github' || parsed.source === 'gitcode' ? parsed.source : null,
      kind: parsed.kind === 'exe' || parsed.kind === 'zip' ? parsed.kind : null,
      remember: parsed.remember !== false,
      backup: parsed.backup === true,
      lastGoodSource:
        parsed.lastGoodSource === 'github' || parsed.lastGoodSource === 'gitcode' ? parsed.lastGoodSource : null
    }
  } catch {
    return { ...DEFAULT_UPDATE_PREFS }
  }
}

export function saveUpdatePrefs(patch: Partial<UpdatePrefs>): UpdatePrefs {
  const next = { ...loadUpdatePrefs(), ...patch }
  try {
    setSetting(UPDATE_PREFS_KEY, JSON.stringify(next))
  } catch {
    /* 写库失败不阻断更新流程 */
  }
  return next
}

/**
 * 用户未勾「记住本次设置」时，下次打开选源弹窗应回到默认态：
 * 只沿用 source/kind 之外的字段（remember/backup 是长期偏好）。
 */
export function effectivePrefs(prefs: UpdatePrefs): { source: UpdateSource | null; kind: InstallerKind | null } {
  if (!prefs.remember) return { source: null, kind: null }
  return { source: prefs.source, kind: prefs.kind }
}
