/**
 * 双源 Release 查询（GitHub / GitCode）。
 *
 * 设计要点（均为本机实测结论，见 design/UPDATE-v2.1-SPEC.md §0.1）：
 * - GitHub 的**未认证 REST API 有 60 次/小时/IP 配额**，被限流时返回 403；出口 IP 共享（VPN/公司网）时很容易打满。
 *   → 主通道走 API，失败自动降级到**无配额通道**：`releases.atom`（含完整正文）+ 确定性资产 URL + `commits/<tag>.atom` 取提交号。
 * - GitCode 的 API **免 token**（实测 `GET /api/v5/repos/<owner>/<repo>/releases` 直接返回正文/target_commitish/资产直链），
 *   但其资产对象**没有 size 字段** → 需要大小时用 `GET` + `Range: bytes=0-0` 读 `Content-Range`。
 * - 两端资产命名一致（由 package.json 的 artifactName 决定），下载地址可按规则拼出，无需 API。
 * - **下载/探测一律用 GET 跟随 302**：GitCode 的 `HEAD` 会被拦成 401；CDN 链接带时效签名，续传时要重新请求原始地址。
 */
import type { AssetRef, InstallerKind, ReleaseInfo, UpdateSource } from './types'
import { htmlToText, normalizeVersion, pickLatest } from './semver'
import { httpGet, httpGetOk, httpRedirectTarget, jsonOf, textOf, withRetry } from './http'

export const GITHUB_REPO = 'fanfan-2011/Translator-MC'
export const GITCODE_REPO = 'Fanfan01sh/Translator-MC'

const WEB: Record<UpdateSource, string> = {
  github: `https://github.com/${GITHUB_REPO}`,
  gitcode: `https://gitcode.com/${GITCODE_REPO}`
}

const UA = 'Translator-MC'
const TIMEOUT_MS = 8000

/** 产物文件名（与 package.json 的 artifactName 一致，两端通用） */
export function artifactName(kind: InstallerKind, version: string): string {
  return kind === 'exe'
    ? `Translator-MC-Setup-win-${version}.exe`
    : `Translator-MC-mobile-win-${version}.zip`
}

function artifactUrl(source: UpdateSource, tag: string, name: string): string {
  return `${WEB[source]}/releases/download/${tag}/${name}`
}

/** 组装资产：优先用 API 返回的真实条目，缺失则按命名规则拼确定性 URL */
function assetsFor(
  source: UpdateSource,
  tag: string,
  version: string,
  apiAssets?: { name: string; url: string; size?: number; sha256?: string }[]
): ReleaseInfo['assets'] {
  const out: ReleaseInfo['assets'] = {}
  for (const kind of ['exe', 'zip'] as InstallerKind[]) {
    const want = artifactName(kind, version)
    const hit = apiAssets?.find((a) => a.name === want)
    out[kind] = hit
      ? { name: hit.name, url: hit.url, size: hit.size, sha256: hit.sha256 }
      : { name: want, url: artifactUrl(source, tag, want) }
  }
  return out
}

// 全部走 Electron 的 net（见 http.ts 顶部说明：这样才能继承系统代理 / PAC / 企业证书）。
async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  return withRetry(url, async () => jsonOf<T>(await httpGetOk(url, { headers, idleTimeoutMs: TIMEOUT_MS })))
}

async function getText(url: string, headers?: Record<string, string>): Promise<string> {
  return withRetry(url, async () => textOf(await httpGetOk(url, { headers, idleTimeoutMs: TIMEOUT_MS })))
}

/**
 * API 通道专用：**一次尝试，失败立刻降级**。
 *
 * 为什么不重试：API 失败（被墙、限流、公司网出口 IP 打满）时，正确动作是**马上走备用通道**，
 * 而不是原地重试。实测屏蔽 api.github.com 后，原来的 4 次重试（8s 超时 + 1/3/7s 退避）
 * 把一次「检查更新」拖到 **36 秒**才靠 atom 通道出结果 —— 用户看到的是一直转圈。
 */
const API_TIMEOUT_MS = 4000

async function getJsonOnce<T>(url: string, headers?: Record<string, string>): Promise<T> {
  return jsonOf<T>(await httpGetOk(url, { headers, idleTimeoutMs: API_TIMEOUT_MS }))
}

// ---------- GitHub ----------

interface GhAsset {
  name?: string
  browser_download_url?: string
  size?: number
  digest?: string
}
interface GhRelease {
  tag_name?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
  target_commitish?: string
  published_at?: string
  assets?: GhAsset[]
}

async function githubCommit(tag: string): Promise<string | undefined> {
  try {
    const j = await getJsonOnce<{ sha?: string }>(`https://api.github.com/repos/${GITHUB_REPO}/commits/${tag}`, {
      Accept: 'application/vnd.github+json'
    })
    if (j.sha) return j.sha.slice(0, 8)
  } catch {
    /* 配额用尽 → 走 atom */
  }
  try {
    const xml = await getText(`${WEB.github}/commits/${tag}.atom`)
    const m = /Grit::Commit\/([0-9a-f]{40})/.exec(xml)
    if (m) return m[1].slice(0, 8)
  } catch {
    /* 提交号拿不到不影响主流程 */
  }
  return undefined
}

/** GitHub：官方 REST API（首选） */
export async function fetchGithubViaApi(): Promise<ReleaseInfo> {
  const list = await getJsonOnce<GhRelease[]>(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`, {
    Accept: 'application/vnd.github+json'
  })
  const stable = (Array.isArray(list) ? list : []).filter((r) => !r.draft && !r.prerelease && !!r.tag_name)
  const tag = pickLatest(stable.map((r) => r.tag_name as string))
  const rel = stable.find((r) => r.tag_name === tag)
  if (!rel || !rel.tag_name) throw new Error('没有可用的正式 Release')
  const version = normalizeVersion(rel.tag_name)
  const target = rel.target_commitish ?? ''
  const commit = /^[0-9a-f]{7,40}$/i.test(target) ? target.slice(0, 8) : await githubCommit(rel.tag_name)
  return {
    source: 'github',
    tag: rel.tag_name,
    version,
    changelog: htmlToText(rel.body ?? ''),
    commit,
    prerelease: false,
    publishedAt: rel.published_at,
    assets: assetsFor(
      'github',
      rel.tag_name,
      version,
      (rel.assets ?? [])
        .filter((a) => !!a.name && !!a.browser_download_url)
        .map((a) => ({
          name: a.name as string,
          url: a.browser_download_url as string,
          size: a.size,
          // GitHub 的 digest 形如 "sha256:abc…"，剥掉前缀供下载器校验
          sha256: typeof a.digest === 'string' ? a.digest.replace(/^sha256:/, '') : undefined
        }))
    ),
    channel: 'api'
  }
}

export interface AtomEntry {
  title: string
  tag: string
  updated?: string
  content: string
}

/** 解析 releases.atom（GitHub / GitCode 通用） */
export function parseAtomEntries(xml: string): AtomEntry[] {
  const out: AtomEntry[] = []
  for (const block of String(xml ?? '').match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
    const href = /<link[^>]+href="([^"]+)"/.exec(block)?.[1] ?? ''
    const id = (/<id>([\s\S]*?)<\/id>/.exec(block)?.[1] ?? '').trim()
    const titleRaw = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? ''
    const fromHref = /\/releases\/tag\/([^/?#"]+)/.exec(href)?.[1]
    const fromId = id.split('/').pop()
    const fromTitle = /(v\d[\w.\-]*)/.exec(titleRaw)?.[1]
    const tag = decodeURIComponent(fromHref ?? fromId ?? fromTitle ?? '')
    if (!tag) continue
    out.push({
      title: htmlToText(titleRaw),
      tag,
      updated: /<updated>([\s\S]*?)<\/updated>/.exec(block)?.[1]?.trim(),
      content: /<content[^>]*>([\s\S]*?)<\/content>/.exec(block)?.[1] ?? ''
    })
  }
  return out
}

/** GitHub：无配额备用通道（atom + 确定性 URL） */
export async function fetchGithubViaAtom(): Promise<ReleaseInfo> {
  let latestTag: string | null = null
  // /releases/latest 会 302 到最新**正式** tag（自动排除预发布/草稿），免配额
  const loc = await httpRedirectTarget(`${WEB.github}/releases/latest`, TIMEOUT_MS)
  const m = loc ? /\/releases\/tag\/([^/?#]+)/.exec(loc) : null
  if (m) latestTag = decodeURIComponent(m[1])
  const entries = parseAtomEntries(await getText(`${WEB.github}/releases.atom`))
  const entry = (latestTag ? entries.find((e) => e.tag === latestTag) : undefined) ?? entries[0]
  if (!entry) throw new Error('atom 中没有 Release 条目')
  const version = normalizeVersion(entry.tag)
  return {
    source: 'github',
    tag: entry.tag,
    version,
    changelog: htmlToText(entry.content),
    commit: await githubCommit(entry.tag),
    prerelease: false,
    publishedAt: entry.updated,
    assets: assetsFor('github', entry.tag, version),
    channel: 'atom'
  }
}

// ---------- GitCode ----------

interface GcAsset {
  name?: string
  browser_download_url?: string
}
interface GcRelease {
  tag_name?: string
  body?: string
  prerelease?: boolean
  target_commitish?: string
  created_at?: string
  assets?: GcAsset[]
}

/** GitCode：官方 API（免 token） */
export async function fetchGitcodeViaApi(): Promise<ReleaseInfo> {
  const list = await getJsonOnce<GcRelease[]>(`https://api.gitcode.com/api/v5/repos/${GITCODE_REPO}/releases?per_page=20`)
  const stable = (Array.isArray(list) ? list : []).filter((r) => !r.prerelease && !!r.tag_name)
  const tag = pickLatest(stable.map((r) => r.tag_name as string))
  const rel = stable.find((r) => r.tag_name === tag)
  if (!rel || !rel.tag_name) throw new Error('没有可用的正式 Release')
  const version = normalizeVersion(rel.tag_name)
  const target = rel.target_commitish ?? ''
  return {
    source: 'gitcode',
    tag: rel.tag_name,
    version,
    changelog: htmlToText(rel.body ?? ''),
    commit: /^[0-9a-f]{7,40}$/i.test(target) ? target.slice(0, 8) : undefined,
    prerelease: false,
    publishedAt: rel.created_at,
    assets: assetsFor(
      'gitcode',
      rel.tag_name,
      version,
      (rel.assets ?? [])
        .filter((a) => !!a.name && !!a.browser_download_url)
        .map((a) => ({ name: a.name as string, url: a.browser_download_url as string }))
    ),
    channel: 'api'
  }
}

/** GitCode：无配额备用通道 */
export async function fetchGitcodeViaAtom(): Promise<ReleaseInfo> {
  const entries = parseAtomEntries(await getText(`${WEB.gitcode}/releases.atom`))
  const entry = entries[0]
  if (!entry) throw new Error('atom 中没有 Release 条目')
  const version = normalizeVersion(entry.tag)
  return {
    source: 'gitcode',
    tag: entry.tag,
    version,
    changelog: htmlToText(entry.content),
    publishedAt: entry.updated,
    assets: assetsFor('gitcode', entry.tag, version),
    prerelease: false,
    channel: 'atom'
  }
}

/** 查单一来源（自动降级通道），并统一补上网页地址 */
export async function fetchRelease(source: UpdateSource): Promise<ReleaseInfo> {
  let info: ReleaseInfo
  if (source === 'github') {
    try {
      info = await fetchGithubViaApi()
    } catch {
      info = await fetchGithubViaAtom()
    }
  } else {
    try {
      info = await fetchGitcodeViaApi()
    } catch {
      info = await fetchGitcodeViaAtom()
    }
  }
  return { ...info, pageUrl: `${WEB[source]}/releases/tag/${info.tag}` }
}

/**
 * 用 1 字节 Range 探测资产总大小（GitCode 的 API 不返回 size）。
 * 注意：必须 GET（HEAD 会被拦），走 net 自动跟随 302。
 */
export async function probeSize(url: string): Promise<number | undefined> {
  try {
    const res = await httpGet(url, { headers: { Range: 'bytes=0-0' }, idleTimeoutMs: TIMEOUT_MS })
    if (res.status !== 206 && (res.status < 200 || res.status >= 300)) return undefined
    const cr = res.headers['content-range']
    const m = cr ? /\/(\d+)\s*$/.exec(cr) : null
    const size = m ? parseInt(m[1], 10) : parseInt(res.headers['content-length'] ?? '', 10)
    return Number.isFinite(size) ? size : undefined
  } catch {
    return undefined
  }
}

export type { AssetRef }
