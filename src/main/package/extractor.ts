import { randomUUID } from 'crypto'
import type { VFS } from './vfs'
import { parseContent, extractPlaceholders } from '../parser'
import type { PackageType, TranslationEntry, TranslationIssue } from '@shared/types'

const LANG_EXTS = new Set(['json', 'json5', 'lang', 'properties', 'yaml', 'yml', 'toml'])

// 语言代码规范化：把 en-US / enus / en_us 等统一成 en_us 形式
function normalizeCode(code: string): string {
  const c = code.toLowerCase().replace(/-/g, '_')
  const map: Record<string, string> = {
    en: 'en_us',
    enus: 'en_us',
    en_gb: 'en_gb',
    enau: 'en_au',
    ja: 'ja_jp',
    jajp: 'ja_jp',
    ko: 'ko_kr',
    kokr: 'ko_kr',
    zh: 'zh_cn',
    zhcn: 'zh_cn',
    zhtw: 'zh_tw',
    zhhk: 'zh_hk',
    de: 'de_de',
    dede: 'de_de',
    fr: 'fr_fr',
    frfr: 'fr_fr',
    ru: 'ru_ru',
    ruru: 'ru_ru',
    es: 'es_es',
    eses: 'es_es',
    esmx: 'es_mx',
    pt: 'pt_br',
    ptbr: 'pt_br',
    it: 'it_it',
    itit: 'it_it',
    pl: 'pl_pl',
    nl: 'nl_nl',
    tr: 'tr_tr',
    sv: 'sv_se',
    no: 'no_no',
    cs: 'cs_cz',
    hu: 'hu_hu'
  }
  return map[c] ?? c
}

function codeFromFile(fname: string): string {
  const base = fname.split('/').pop() ?? ''
  return base.replace(/\.(json|json5|lang|properties|yaml|yml|toml)$/i, '')
}

function extOf(fname: string): string {
  const i = fname.lastIndexOf('.')
  return i >= 0 ? fname.slice(i + 1).toLowerCase() : ''
}

interface LangFile {
  path: string
  code: string
  normCode: string
}

// 找到所有候选语言文件，返回规范化后的语言代码
function findLanguageFiles(vfs: VFS): LangFile[] {
  const out: LangFile[] = []
  for (const f of vfs.listFiles()) {
    const e = extOf(f)
    if (!LANG_EXTS.has(e)) continue
    const lower = f.toLowerCase()
    const inLangDir = lower.includes('/lang/') || lower.includes('\\lang\\')
    if (!inLangDir && e !== 'lang') continue
    const code = codeFromFile(f).toLowerCase()
    out.push({ path: f, code, normCode: normalizeCode(code) })
  }
  return out
}

function findLine(content: string, key: string): number {
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(key)) return i + 1
  }
  return 0
}

function categoryFromPath(path: string): string {
  const parts = path.split('/')
  const langIdx = parts.findIndex((p) => p.toLowerCase() === 'lang')
  if (langIdx >= 1) return parts[langIdx - 1]
  return parts[0] ?? ''
}

export interface ExtractOutput {
  entries: TranslationEntry[]
  languageFiles: string[]
  builtinCount: number
  sourceCode: string
  targetCode: string
}

export function extractEntries(
  vfs: VFS,
  projectId: string,
  packageId: string,
  packageType: PackageType,
  targetCode = 'zh_cn'
): ExtractOutput {
  const langFiles = findLanguageFiles(vfs)
  const normTarget = normalizeCode(targetCode)

  // 目标语言文件（用于已有翻译检测）
  const targetFiles = langFiles.filter((f) => f.normCode === normTarget)

  // 源语言：优先英语，否则第一个非目标语言的语言
  const nonTarget = langFiles.filter((f) => f.normCode !== normTarget)
  const enFiles = nonTarget.filter((f) => f.normCode === 'en_us' || f.normCode === 'en_gb')
  const sourceFiles = enFiles.length > 0 ? enFiles : nonTarget

  const sourceCode = sourceFiles.length > 0 ? sourceFiles[0].normCode : 'en_us'
  const languageFiles = langFiles.map((f) => f.path)

  // 解析目标语言文件 → key -> 译文
  const targetMap = new Map<string, string>()
  for (const t of targetFiles) {
    try {
      const content = vfs.readText(t.path)
      for (const { key, value } of parseContent(content, t.path)) {
        if (value && value.trim() !== '') targetMap.set(key, value)
      }
    } catch {
      /* ignore unreadable */
    }
  }

  const seen = new Set<string>()
  const entries: TranslationEntry[] = []

  for (const src of sourceFiles) {
    let content = ''
    try {
      content = vfs.readText(src.path)
    } catch {
      continue
    }
    const parsed = parseContent(content, src.path)
    for (const { key, value } of parsed) {
      // Skip empty/null values — empty placeholders (e.g. "value.info0.0=") in
      // shader/lang files are not translatable and cause spurious "missing" failures.
      if (!key || value === undefined || value === null || value.trim() === '') continue
      const dupKey = seen.has(key)
      seen.add(key)

      const existing = targetMap.get(key)
      const hasBuiltin = existing !== undefined && existing.trim() !== ''

      const placeholders = extractPlaceholders(value)
      const issues: TranslationIssue[] = []
      if (dupKey) {
        issues.push({ type: 'duplicate_key', severity: 'warning', message: `键 "${key}" 在多个文件中重复出现` })
      }

      const id = randomUUID()
      entries.push({
        id,
        projectId,
        packageId,
        key,
        sourceText: value,
        targetText: hasBuiltin ? existing : '',
        originalTargetText: hasBuiltin ? existing : '',
        status: hasBuiltin ? 'builtin' : 'pending',
        selected: !hasBuiltin,
        note: '',
        category: categoryFromPath(src.path),
        filePath: src.path,
        lineNumber: findLine(content, key),
        placeholders,
        issues,
        qualityScore: null,
        updatedAt: new Date().toISOString()
      })
    }
  }

  const builtinCount = entries.filter((e) => e.status === 'builtin').length
  return { entries, languageFiles, builtinCount, sourceCode, targetCode: normTarget }
}
