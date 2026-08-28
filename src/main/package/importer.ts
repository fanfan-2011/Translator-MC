import { randomUUID } from 'crypto'
import { basename } from 'path'
import { openVfs } from './vfs'
import { detectPackage } from './detector'
import { extractEntries } from './extractor'
import * as db from '../db/database'
import { logger } from '../logger'
import type { ImportResult, PackageInfo, PackageType, TranslationEntry } from '@shared/types'

function defaultProjectName(paths: string[]): string {
  const first = paths[0]
  const base = basename(first).replace(/\.(jar|zip)$/i, '')
  return base || '翻译项目'
}

export interface DetectedPreview {
  sourcePath: string
  type: PackageType
  name: string
  version: string
  modId: string
  evidence: string[]
  entryCount: number
  builtinCount: number
}

// Analyse a source WITHOUT committing to the database (used for the import preview).
export async function previewPackage(sourcePath: string, hint?: PackageType, targetCode = 'zh_cn'): Promise<DetectedPreview> {
  const { vfs } = await openVfs(sourcePath)
  const det = detectPackage(vfs, hint)
  const { entries, builtinCount } = extractEntries(vfs, 'preview', 'preview', det.type, targetCode)
  return {
    sourcePath,
    type: det.type,
    name: det.name,
    version: det.version,
    modId: det.modId,
    evidence: det.evidence,
    entryCount: entries.length,
    builtinCount
  }
}

export async function importFiles(
  sourcePaths: string[],
  projectId?: string,
  hint?: PackageType,
  targetCode = 'zh_cn'
): Promise<ImportResult> {
  const project = projectId && db.getProject(projectId) ? db.getProject(projectId)! : db.createProject(defaultProjectName(sourcePaths))
  const packages: PackageInfo[] = []
  const entries: TranslationEntry[] = []
  const languageFiles: string[] = []
  const packageTypes: Partial<Record<PackageType, number>> = {}
  let builtinCount = 0

  for (const sourcePath of sourcePaths) {
    logger.info(`导入: ${sourcePath}`)
    const { vfs } = await openVfs(sourcePath)
    const det = detectPackage(vfs, hint)
    const pkgId = randomUUID()
    const pkg: PackageInfo = {
      id: pkgId,
      projectId: project.id,
      name: det.name,
      type: det.type,
      sourcePath,
      version: det.version,
      modId: det.modId
    }
    db.insertPackage(pkg)
    packages.push(pkg)
    packageTypes[det.type] = (packageTypes[det.type] ?? 0) + 1

    const out = extractEntries(vfs, project.id, pkgId, det.type, targetCode)
    builtinCount += out.builtinCount
    languageFiles.push(...out.languageFiles)
    if (out.entries.length > 0) db.insertEntries(out.entries)
    entries.push(...out.entries)
    logger.info(`  → 识别为 ${det.type}，提取 ${out.entries.length} 条文本（自带中文 ${out.builtinCount} 条）`)
  }

  db.renameProject(project.id, project.name)

  return {
    projectId: project.id,
    packages,
    entries,
    stats: {
      packageCount: packages.length,
      entryCount: entries.length,
      builtinCount,
      languageFiles: [...new Set(languageFiles)],
      packageTypes
    }
  }
}
