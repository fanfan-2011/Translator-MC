/**
 * 用户配置导出 / 导入（需求 4、5）。
 *
 * 用户裁决（见 design/UPDATE-v2.1-SPEC.md §5.1）：
 * - 备份范围 = **设置项 + 术语表 + 翻译记忆**（不含项目与翻译条目）；
 * - API Key **随配置导出，但必须保持 Windows 加密**：`llm_config` 里的 apiKey 本来就是
 *   `main/security.ts` 的 `enc:`（safeStorage / DPAPI）密文，原样导出即满足"仅同机同账户可还原"，
 *   **绝不在这里解密、绝不写明文**。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  getSetting,
  insertGlossary,
  listGlossary,
  listMemory,
  setSetting,
  upsertMemory
} from '../db/database'
import type { GlossaryEntry, MemoryEntry } from '@shared/types'

export const CONFIG_KIND = 'tsm-config'
export const CONFIG_FORMAT_VERSION = 1

/** 允许导出/导入的设置键白名单（防止外部文件塞入未知键） */
export const KNOWN_SETTING_KEYS = ['theme', 'llm_config', 'update_prefs'] as const

export interface ConfigFile {
  kind: typeof CONFIG_KIND
  formatVersion: number
  app: string
  appVersion: string
  exportedAt: string
  /** settings 表的原始键值（apiKey 保持 enc: 密文） */
  settings: Record<string, string>
  glossary: GlossaryEntry[]
  memory: MemoryEntry[]
  counts: {
    glossary: number
    memory: number
    /** API Key 是否为本机加密（enc:）而不是明文兜底（plain:） */
    apiKeyEncrypted: boolean
    apiKeyIncluded: boolean
  }
}

export interface ImportSummary {
  ok: true
  /** 实际写入的设置键 */
  settingsApplied: string[]
  glossaryAdded: number
  glossarySkipped: number
  memoryUpserted: number
  /** 导入前的自动备份路径 */
  backupPath?: string
  warnings: string[]
}

export interface ConfigError {
  ok: false
  error: string
}

/** 快照当前配置（纯读） */
export function buildConfigSnapshot(appVersion: string): ConfigFile {
  const settings: Record<string, string> = {}
  for (const key of KNOWN_SETTING_KEYS) {
    const v = getSetting(key)
    if (v !== undefined && v !== '') settings[key] = v
  }

  let apiKeyEncrypted = false
  let apiKeyIncluded = false
  try {
    const llm = JSON.parse(settings['llm_config'] ?? '{}') as { apiKey?: string }
    if (llm.apiKey) {
      apiKeyIncluded = true
      apiKeyEncrypted = llm.apiKey.startsWith('enc:')
    }
  } catch {
    /* llm_config 解析失败就不声称包含密钥 */
  }

  const glossary = listGlossary()
  const memory = listMemory()

  return {
    kind: CONFIG_KIND,
    formatVersion: CONFIG_FORMAT_VERSION,
    app: 'Translator MC',
    appVersion,
    exportedAt: new Date().toISOString(),
    settings,
    glossary,
    memory,
    counts: {
      glossary: glossary.length,
      memory: memory.length,
      apiKeyEncrypted,
      apiKeyIncluded
    }
  }
}

/** 导出到指定路径（调用方负责弹保存对话框） */
export function exportConfigTo(path: string, appVersion: string): ConfigFile {
  const snapshot = buildConfigSnapshot(appVersion)
  writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf8')
  return snapshot
}

/** 导入前把当前配置自动备份到备份目录（需求 8） */
export function backupCurrentConfig(backupDir: string, appVersion: string): string {
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join(backupDir, `config-before-import-${stamp}.json`)
  writeFileSync(path, JSON.stringify(buildConfigSnapshot(appVersion), null, 2), 'utf8')
  return path
}

/** 校验外部文件（不信任任何字段） */
export function validateConfigFile(raw: unknown): ConfigFile | ConfigError {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '不是有效的 JSON 对象' }
  const obj = raw as Partial<ConfigFile>
  if (obj.kind !== CONFIG_KIND) return { ok: false, error: '不是 Translator MC 的配置文件' }
  if (typeof obj.formatVersion !== 'number' || obj.formatVersion > CONFIG_FORMAT_VERSION) {
    return { ok: false, error: `配置格式版本不支持（文件 v${String(obj.formatVersion)}，本程序支持到 v${CONFIG_FORMAT_VERSION}）` }
  }
  const settings = obj.settings && typeof obj.settings === 'object' ? obj.settings : {}
  const glossary = Array.isArray(obj.glossary) ? obj.glossary : []
  const memory = Array.isArray(obj.memory) ? obj.memory : []
  return {
    kind: CONFIG_KIND,
    formatVersion: obj.formatVersion,
    app: typeof obj.app === 'string' ? obj.app : 'Translator MC',
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : '',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    settings: settings as Record<string, string>,
    glossary: glossary as GlossaryEntry[],
    memory: memory as MemoryEntry[],
    counts: {
      glossary: glossary.length,
      memory: memory.length,
      apiKeyEncrypted: false,
      apiKeyIncluded: false
    }
  }
}

export interface ImportOptions {
  /** 导入前自动备份目录（省略则不备份） */
  backupDir?: string
  appVersion: string
}

/**
 * 应用配置：设置项写回白名单键；术语表按 (source,target) 去重；翻译记忆按源文 upsert。
 * 任何一条坏数据只跳过并计入 warnings，不中断整体导入。
 */
export function applyConfigFile(file: ConfigFile, opts: ImportOptions): ImportSummary {
  const warnings: string[] = []

  let backupPath: string | undefined
  if (opts.backupDir) {
    try {
      backupPath = backupCurrentConfig(opts.backupDir, opts.appVersion)
    } catch (e) {
      warnings.push(`导入前备份失败（不影响导入）：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 1) 设置项（只认白名单）
  const settingsApplied: string[] = []
  for (const key of KNOWN_SETTING_KEYS) {
    const value = file.settings[key]
    if (typeof value !== 'string' || value === '') continue
    if (key === 'llm_config') {
      try {
        const parsed = JSON.parse(value) as { apiKey?: string }
        if (parsed.apiKey && parsed.apiKey.startsWith('plain:')) {
          warnings.push('该配置里的 API Key 未加密（导出机器上系统加密不可用）；若换过电脑可能无法还原，请检查设置里的密钥。')
        }
      } catch {
        warnings.push('配置文件里的 llm_config 不是合法 JSON，已跳过该项。')
        continue
      }
    }
    try {
      setSetting(key, value)
      settingsApplied.push(key)
    } catch (e) {
      warnings.push(`写入设置 ${key} 失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 2) 术语表：按 (source, target) 去重
  const existing = new Set(listGlossary().map((g) => `${g.source}\u0000${g.target}`))
  let glossaryAdded = 0
  let glossarySkipped = 0
  for (const g of file.glossary) {
    if (!g || typeof g.source !== 'string' || typeof g.target !== 'string' || !g.source || !g.target) {
      glossarySkipped++
      continue
    }
    const key = `${g.source}\u0000${g.target}`
    if (existing.has(key)) {
      glossarySkipped++
      continue
    }
    try {
      insertGlossary({
        source: g.source,
        target: g.target,
        caseSensitive: !!g.caseSensitive,
        packageType: g.packageType ?? 'all',
        note: g.note ?? ''
      } as Omit<GlossaryEntry, 'id'>)
      existing.add(key)
      glossaryAdded++
    } catch (e) {
      glossarySkipped++
      warnings.push(`术语「${g.source}」写入失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 3) 翻译记忆：按源文 upsert（幂等）
  let memoryUpserted = 0
  for (const m of file.memory) {
    if (!m || typeof m.sourceText !== 'string' || typeof m.targetText !== 'string' || !m.sourceText) continue
    try {
      upsertMemory(m.sourceText, m.targetText, m.packageType ?? 'all', m.targetCode ?? '')
      memoryUpserted++
    } catch (e) {
      warnings.push(`记忆条目写入失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { ok: true, settingsApplied, glossaryAdded, glossarySkipped, memoryUpserted, backupPath, warnings }
}

/** 从磁盘读取并导入 */
export function importConfigFrom(path: string, opts: ImportOptions): ImportSummary | ConfigError {
  if (!existsSync(path)) return { ok: false, error: '文件不存在' }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return { ok: false, error: `读取/解析失败：${e instanceof Error ? e.message : String(e)}` }
  }
  const valid = validateConfigFile(raw)
  if ('ok' in valid) return valid
  return applyConfigFile(valid, opts)
}
