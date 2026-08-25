import AdmZip from 'adm-zip'
import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import type { ExportOptions, ExportResult, TranslationEntry } from '@shared/types'
import * as db from '../db/database'
import { logger } from '../logger'
import { isSafeEntryName } from '../package/vfs'

const PACK_FORMAT = 34 // Minecraft 1.21

// 导出写回 zip 前清理条目名（DB 中可能是历史遗留的恶意路径）
function safeZipPath(p: string): string {
  const norm = p.replace(/\\/g, '/')
  if (isSafeEntryName(norm)) return norm
  // 去掉绝对路径/盘符/.. 段，保留可用的相对段
  const parts = norm
    .replace(/^\/+/, '')
    .replace(/^[a-zA-Z]:\//, '')
    .split('/')
    .filter((x) => x !== '..' && x !== '')
  return parts.join('/')
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i >= 0 ? path.slice(i + 1).toLowerCase() : ''
}

// Derive the target language file path from a source path.
// Source paths may be jar-internal (mods/x.jar!assets/xenon/lang/en_us.lang) —
// strip everything before the last "assets/" so the exported resource-pack entry
// is a clean assets/<modid>/lang/<code>.<ext> path.
function targetPath(sourcePath: string, targetCode: string): string {
  const norm = sourcePath.replace(/\\/g, '/')
  let rel = norm
  const idx = norm.lastIndexOf('assets/')
  if (idx >= 0) rel = norm.slice(idx)
  const parts = rel.split('/')
  const fname = parts[parts.length - 1]
  const ext = extOf(fname)
  const targetExt = ext === 'lang' || ext === 'properties' ? 'lang' : 'json'
  parts[parts.length - 1] = `${targetCode}.${targetExt}`
  return parts.join('/')
}

function serialize(entries: { key: string; value: string }[], sourceExt: string): string {
  if (sourceExt === 'lang' || sourceExt === 'properties') {
    return entries.map((e) => `${e.key}=${e.value}`).join('\n') + '\n'
  }
  const obj: Record<string, string> = {}
  for (const e of entries) obj[e.key] = e.value
  return JSON.stringify(obj, null, 2)
}

function collectTranslatedFiles(
  entries: TranslationEntry[],
  skipBuiltin: boolean,
  targetCode: string
): Map<string, { content: string; sourceExt: string }> {
  const bySource = new Map<string, { key: string; value: string; sourceExt: string }[]>()
  for (const e of entries) {
    if (!e.targetText || e.targetText.trim() === '') continue
    if (skipBuiltin && e.status === 'builtin') continue
    if (e.status !== 'builtin' && !e.selected) continue
    const list = bySource.get(e.filePath) ?? []
    list.push({ key: e.key, value: e.targetText, sourceExt: extOf(e.filePath) })
    bySource.set(e.filePath, list)
  }

  const out = new Map<string, { content: string; sourceExt: string }>()
  for (const [src, list] of bySource) {
    if (list.length === 0) continue
    out.set(targetPath(src, targetCode), { content: serialize(list, list[0].sourceExt), sourceExt: list[0].sourceExt })
  }
  return out
}

function buildPackMcmeta(): string {
  return JSON.stringify(
    { pack: { pack_format: PACK_FORMAT, description: 'Translator MC 汉化包' } },
    null,
    2
  )
}

// Pre-export validation. Returns issue descriptions.
export function exportPreCheck(projectId: string): { count: number; messages: string[] } {
  const entries = db.listEntries(projectId)
  const messages: string[] = []
  const keyCount = new Map<string, number>()
  for (const e of entries) {
    if (!e.targetText || e.targetText.trim() === '') {
      messages.push(`未翻译: "${e.key}" (${e.sourceText})`)
      continue
    }
    for (const issue of e.issues) {
      if (issue.severity === 'error') {
        messages.push(`[${issue.type}] "${e.key}": ${issue.message}`)
        break
      }
    }
    keyCount.set(e.key, (keyCount.get(e.key) ?? 0) + 1)
  }
  for (const [k, c] of keyCount) {
    if (c > 1) messages.push(`重复 key: "${k}" 出现 ${c} 次`)
  }
  return { count: messages.length, messages: messages.slice(0, 200) }
}

async function exportResourcePack(
  entries: TranslationEntry[],
  outputPath: string,
  skipBuiltin: boolean,
  targetCode: string
): Promise<void> {
  const files = collectTranslatedFiles(entries, skipBuiltin, targetCode)
  const zip = new AdmZip()
  zip.addFile('pack.mcmeta', Buffer.from(buildPackMcmeta(), 'utf8'))
  for (const [path, { content }] of files) {
    zip.addFile(safeZipPath(path), Buffer.from(content, 'utf8'))
  }
  zip.writeZip(outputPath)
  logger.info(`资源包已导出: ${outputPath} (${files.size} 个语言文件)`)
}

async function exportJars(
  projectId: string,
  entries: TranslationEntry[],
  skipBuiltin: boolean,
  targetCode: string
): Promise<string[]> {
  const packages = db.listPackages(projectId)
  const outputs: string[] = []
  for (const pkg of packages) {
    if (!pkg.sourcePath.toLowerCase().endsWith('.jar')) continue
    const pkgEntries = entries.filter((e) => e.packageId === pkg.id)
    if (pkgEntries.length === 0) continue
    const files = collectTranslatedFiles(pkgEntries, skipBuiltin, targetCode)
    if (files.size === 0) continue

    const zip = new AdmZip(pkg.sourcePath)
    for (const [path, { content }] of files) {
      const safe = safeZipPath(path)
      zip.deleteFile(safe)
      zip.addFile(safe, Buffer.from(content, 'utf8'))
    }
    const base = basename(pkg.sourcePath, '.jar')
    const dir = dirname(pkg.sourcePath)
    const outPath = join(dir, `${base}-localized.jar`)
    zip.writeZip(outPath)
    outputs.push(outPath)
    logger.info(`Jar 已导出: ${outPath} (${files.size} 个语言文件)`)
  }
  return outputs
}

export async function exportProject(
  projectId: string,
  options: ExportOptions,
  outputPath?: string
): Promise<ExportResult> {
  const entries = db.listEntries(projectId)
  const exportable = entries.filter((e) => e.targetText && e.targetText.trim() !== '')
  if (exportable.length === 0) {
    return { ok: false, error: '没有可导出的译文（请先翻译或编辑译文）' }
  }

  const pre = exportPreCheck(projectId)
  const targetCode = options.targetLang || 'zh_cn'
  if (options.kind === 'resourcepack') {
    if (!outputPath) {
      return { ok: false, error: '未指定导出路径' }
    }
    try {
      await exportResourcePack(entries, outputPath, options.skipBuiltin, targetCode)
      return { ok: true, outputPath, issueCount: pre.count }
    } catch (e) {
      logger.error(`资源包导出失败: ${e}`)
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // jar export
  try {
    const outputs = await exportJars(projectId, entries, options.skipBuiltin, targetCode)
    if (outputs.length === 0) {
      return { ok: false, error: '未找到可导出的 .jar 文件' }
    }
    return { ok: true, outputPath: outputs.join('; '), issueCount: pre.count }
  } catch (e) {
    logger.error(`Jar 导出失败: ${e}`)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
