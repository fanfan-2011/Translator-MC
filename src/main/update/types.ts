/**
 * 「更新」功能的共享类型（主进程 / preload / 渲染层三处都从这里引）。
 * 约定：这里不 import 任何 Electron / Node 专有 API，方便 selftest 直接断言。
 */

export type UpdateSource = 'github' | 'gitcode'

/** 一个可下载的安装包资产 */
export interface AssetRef {
  /** 资产文件名，如 Translator-MC-Setup-win-2.1.0.exe */
  name: string
  /** 下载直链（服务端会 302 到 CDN，需用 GET 跟随） */
  url: string
  /** 字节数；GitCode 的 API 不提供 size，下载时由响应头补全 */
  size?: number
  /** sha256（GitHub API 的 digest 会带 `sha256:` 前缀，取用时需剥掉；GitCode 不提供） */
  sha256?: string
}

/** 某一端的 Release 信息（已归一化） */
export interface ReleaseInfo {
  source: UpdateSource
  /** 原始 tag，如 v2.1.0 */
  tag: string
  /** 纯版本号，如 2.1.0 */
  version: string
  /** 变更说明（已转为纯文本，供滚动区显示） */
  changelog: string
  /** 短提交号（8 位十六进制） */
  commit?: string
  prerelease: boolean
  publishedAt?: string
  /** 本次可用的安装包（缺失即该类型不可选） */
  assets: { exe?: AssetRef; zip?: AssetRef }
  /** 命中的通道：api = 官方 API，atom = 无配额备用通道 */
  channel: 'api' | 'atom'
  /** 该 Release 的网页地址（`<host>/<repo>/releases/tag/<tag>`，由 fetchRelease 统一补上） */
  pageUrl?: string
}

/** 单端失败记录（只写日志，不打扰用户） */
export interface SourceError {
  source: UpdateSource
  message: string
}

/** 一次检查的汇总结果 */
export interface CheckResult {
  /** 当前运行版本 */
  current: string
  /** 是否存在可更新版本 */
  available: boolean
  /** 取两端中较新的那一个（用户裁决：取较新的一端并标注来源） */
  best?: ReleaseInfo
  perSource: { github: ReleaseInfo | null; gitcode: ReleaseInfo | null }
  errors: SourceError[]
  /** 检查完成时刻（ms） */
  checkedAt: number
}

/** 安装包类型：exe = 安装版，zip = 便携版 */
export type InstallerKind = 'exe' | 'zip'
