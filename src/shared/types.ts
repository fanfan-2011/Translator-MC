// Shared type definitions used by both the main process (Node backend)
// and the renderer (React frontend).

export type PackageType = 'mod' | 'shader' | 'resourcepack' | 'unknown'

export type EntryStatus =
  | 'pending'
  | 'translating'
  | 'ai_translated'
  | 'human_reviewed'
  | 'builtin'
  | 'skipped'
  | 'failed'
  | 'needs_review'

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed'

export interface TranslationIssue {
  type:
    | 'placeholder'
    | 'format_code'
    | 'json'
    | 'terminology'
    | 'quality'
    | 'empty'
    | 'duplicate_key'
    | 'missing'
  message: string
  severity: 'error' | 'warning'
}

export interface TranslationEntry {
  id: string
  projectId: string
  packageId: string
  key: string
  sourceText: string
  targetText: string
  originalTargetText: string
  status: EntryStatus
  selected: boolean
  note: string
  category: string
  filePath: string
  lineNumber: number
  placeholders: string[]
  issues: TranslationIssue[]
  qualityScore: number | null
  updatedAt: string
}

export interface PackageInfo {
  id: string
  projectId: string
  name: string
  type: PackageType
  sourcePath: string
  version: string
  modId: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface GlossaryEntry {
  id: string
  source: string
  target: string
  caseSensitive: boolean
  packageType: PackageType | 'all'
  note: string
}

export interface MemoryEntry {
  id: string
  sourceText: string
  targetText: string
  packageType: PackageType | 'all'
  targetCode?: string
  hitCount: number
  updatedAt: string
}

export interface HistoryEntry {
  id: string
  entryId: string
  version: number
  source: 'ai' | 'human' | 'ai_review' | 'builtin'
  value: string
  createdAt: string
}

export interface IssueRecord {
  id: string
  projectId: string
  entryId: string
  type: string
  message: string
  resolved: boolean
}

export interface LLMConfig {
  provider: string
  endpoint: string
  apiKey: string
  model: string
  temperature: number
  batchSize: number
  concurrency: number
  requestInterval: number
  maxRetries: number
  timeout: number
  targetLanguage: string
}

export interface LanguageOption {
  code: string
  name: string
}

// 支持的目标语言（可翻译到的语言）
export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'zh_cn', name: '简体中文' },
  { code: 'zh_tw', name: '繁體中文' },
  { code: 'zh_hk', name: '繁體中文（香港）' },
  { code: 'ja_jp', name: '日本語' },
  { code: 'ko_kr', name: '한국어' },
  { code: 'en_us', name: 'English' },
  { code: 'fr_fr', name: 'Français' },
  { code: 'de_de', name: 'Deutsch' },
  { code: 'ru_ru', name: 'Русский' },
  { code: 'es_es', name: 'Español' },
  { code: 'pt_br', name: 'Português (Brasil)' },
  { code: 'it_it', name: 'Italiano' }
]

export function targetLanguageName(code: string): string {
  return TARGET_LANGUAGES.find((l) => l.code === code)?.name ?? '简体中文'
}

export interface TaskInfo {
  id: string
  projectId: string
  type: string
  status: TaskStatus
  progress: number
  total: number
  done: number
  failed: number
  error: string
  createdAt: string
  updatedAt: string
}

export interface ModelInfo {
  id: string
  name: string
}

export interface LogLine {
  ts: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export type ThemePref = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemePref
}

export interface ImportResult {
  projectId: string
  packages: PackageInfo[]
  entries: TranslationEntry[]
  stats: {
    packageCount: number
    entryCount: number
    builtinCount: number
    languageFiles: string[]
    packageTypes: Partial<Record<PackageType, number>>
  }
}

export interface ExportOptions {
  kind: 'resourcepack' | 'jar'
  targetLang: string
  skipBuiltin: boolean
}

export interface ExportResult {
  ok: boolean
  outputPath?: string
  error?: string
  issueCount?: number
}

export interface TranslateProgress {
  taskId: string
  status: TaskStatus
  progress: number
  total: number
  done: number
  failed: number
}

// Generic IPC response envelope
export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}

export const APP_NAME = 'Translator MC'
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'openai-compatible',
  endpoint: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  batchSize: 40,
  concurrency: 2,
  requestInterval: 4000,
  maxRetries: 3,
  timeout: 60000,
  targetLanguage: 'zh_cn'
}

// Well-known provider presets
export const PROVIDER_PRESETS: { id: string; name: string; endpoint: string }[] = [
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1' },
  { id: 'zhipu', name: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: 'Moonshot (Kimi)', endpoint: 'https://api.moonshot.cn/v1' },
  { id: 'ollama', name: 'Ollama', endpoint: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', endpoint: 'http://localhost:1234/v1' },
  { id: 'custom', name: '自定义 Endpoint', endpoint: '' }
]
