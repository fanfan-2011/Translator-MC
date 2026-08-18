import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { logger } from '../logger'
import type {
  AppSettings,
  EntryStatus,
  GlossaryEntry,
  HistoryEntry,
  IssueRecord,
  MemoryEntry,
  PackageInfo,
  Project,
  TaskInfo,
  TranslationEntry,
  TranslationIssue
} from '@shared/types'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false
let saveChain: Promise<void> = Promise.resolve()

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
  source_path TEXT NOT NULL, version TEXT DEFAULT '', mod_id TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_packages_project ON packages(project_id);
CREATE TABLE IF NOT EXISTS translation_entries (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, package_id TEXT NOT NULL,
  key TEXT NOT NULL, source_text TEXT NOT NULL,
  target_text TEXT DEFAULT '', original_target_text TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', selected INTEGER DEFAULT 1,
  note TEXT DEFAULT '', category TEXT DEFAULT '', file_path TEXT DEFAULT '',
  line_number INTEGER DEFAULT 0, placeholders TEXT DEFAULT '[]', issues TEXT DEFAULT '[]',
  quality_score REAL, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_project ON translation_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_entries_key ON translation_entries(key);
CREATE INDEX IF NOT EXISTS idx_entries_source ON translation_entries(source_text);
CREATE INDEX IF NOT EXISTS idx_entries_status ON translation_entries(status);
CREATE TABLE IF NOT EXISTS glossary_entries (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL,
  case_sensitive INTEGER DEFAULT 0, package_type TEXT DEFAULT 'all', note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS translation_memory (
  id TEXT PRIMARY KEY, source_text TEXT NOT NULL, target_text TEXT NOT NULL,
  package_type TEXT DEFAULT 'all', target_code TEXT DEFAULT '', hit_count INTEGER DEFAULT 0, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tm_source ON translation_memory(source_text);
CREATE TABLE IF NOT EXISTS translation_history (
  id TEXT PRIMARY KEY, entry_id TEXT NOT NULL, version INTEGER NOT NULL,
  source TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_entry ON translation_history(entry_id);
CREATE TABLE IF NOT EXISTS translation_tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
  progress REAL DEFAULT 0, total INTEGER DEFAULT 0, done INTEGER DEFAULT 0, failed INTEGER DEFAULT 0,
  error TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, entry_id TEXT NOT NULL,
  type TEXT NOT NULL, message TEXT NOT NULL, resolved INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
`

export async function initDatabase(): Promise<void> {
  // Read the wasm bytes directly and pass wasmBinary — robust under asar packaging.
  const wasmBuf = await fs.readFile(require.resolve('sql.js/dist/sql-wasm.wasm'))
  const wasmBinary = wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength) as ArrayBuffer
  SQL = await initSqlJs({ wasmBinary })
  dbPath = join(app.getPath('userData'), 'gamelocalizer.db')
  logger.info(`数据库路径: ${dbPath}`)
  try {
    const buf = await fs.readFile(dbPath)
    db = new SQL.Database(buf)
  } catch {
    db = new SQL.Database()
  }
  db.run(SCHEMA)
  // 迁移：旧版翻译记忆表没有 target_code 列，补上（已存在则忽略）
  try {
    db.run("ALTER TABLE translation_memory ADD COLUMN target_code TEXT DEFAULT ''")
  } catch {
    // 列已存在，忽略
  }
  // 目标语言索引：旧库迁移后创建；新库由上面 ALTER 流程兜底（SCHEMA 不含此索引，避免旧库执行失败）
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_tm_target ON translation_memory(target_code)')
  } catch {
    // 索引已存在，忽略
  }
  persist()
}

function requireDb(): Database {
  if (!db) throw new Error('数据库未初始化')
  return db
}

// 原子写入：先写临时文件再替换，即使崩溃/断电也不会留下半写的损坏文件
async function writeDbAtomic(data: Buffer): Promise<void> {
  const tmp = `${dbPath}.tmp`
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, dbPath)
}

// 保存队列：所有写入串行执行，避免并发写同一文件导致数据库损坏
function enqueueSave(data: Buffer): Promise<void> {
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      try {
        await writeDbAtomic(data)
      } catch (e) {
        logger.error(`数据库保存失败: ${e}`)
      }
    })
  return saveChain
}

export function persist(): void {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!db || !dirty) return
    dirty = false
    const data = db.export()
    void enqueueSave(Buffer.from(data))
  }, 200)
}

export async function persistNow(): Promise<void> {
  if (!db) return
  const data = db.export()
  await enqueueSave(Buffer.from(data))
}

function rows<T>(sql: string, params: unknown[] = []): T[] {
  const d = requireDb()
  const stmt = d.prepare(sql)
  try {
    stmt.bind(params as never[])
    const out: T[] = []
    while (stmt.step()) out.push(stmt.getAsObject() as unknown as T)
    return out
  } finally {
    stmt.free()
  }
}

function row<T>(sql: string, params: unknown[] = []): T | undefined {
  return rows<T>(sql, params)[0]
}

function run(sql: string, params: unknown[] = []): void {
  const d = requireDb()
  d.run(sql, params as never[])
  persist()
}

function now(): string {
  return new Date().toISOString()
}

function parseIssues(json: string): TranslationIssue[] {
  try {
    return JSON.parse(json) as TranslationIssue[]
  } catch {
    return []
  }
}

function parsePlaceholders(json: string): string[] {
  try {
    return JSON.parse(json) as string[]
  } catch {
    return []
  }
}

interface EntryRow {
  id: string
  project_id: string
  package_id: string
  key: string
  source_text: string
  target_text: string
  original_target_text: string
  status: string
  selected: number
  note: string
  category: string
  file_path: string
  line_number: number
  placeholders: string
  issues: string
  quality_score: number | null
  updated_at: string
}

function mapEntry(r: EntryRow): TranslationEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    packageId: r.package_id,
    key: r.key,
    sourceText: r.source_text,
    targetText: r.target_text ?? '',
    originalTargetText: r.original_target_text ?? '',
    status: (r.status as EntryStatus) || 'pending',
    selected: r.selected === 1,
    note: r.note ?? '',
    category: r.category ?? '',
    filePath: r.file_path ?? '',
    lineNumber: r.line_number ?? 0,
    placeholders: parsePlaceholders(r.placeholders ?? '[]'),
    issues: parseIssues(r.issues ?? '[]'),
    qualityScore: r.quality_score ?? null,
    updatedAt: r.updated_at ?? ''
  }
}

// ---------- Projects ----------

export function createProject(name: string): Project {
  const id = randomUUID()
  const ts = now()
  run('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?,?,?,?)', [
    id,
    name,
    ts,
    ts
  ])
  return { id, name, createdAt: ts, updatedAt: ts }
}

export function listProjects(): Project[] {
  return rows<{ id: string; name: string; created_at: string; updated_at: string }>(
    'SELECT * FROM projects ORDER BY updated_at DESC'
  ).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }))
}

export function getProject(id: string): Project | undefined {
  const r = row<{ id: string; name: string; created_at: string; updated_at: string }>(
    'SELECT * FROM projects WHERE id = ?',
    [id]
  )
  return r ? { id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at } : undefined
}

export function renameProject(id: string, name: string): void {
  run('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id])
}

export function deleteProject(id: string): void {
  run('DELETE FROM projects WHERE id = ?', [id])
  run('DELETE FROM packages WHERE project_id = ?', [id])
  run('DELETE FROM translation_entries WHERE project_id = ?', [id])
  run('DELETE FROM translation_tasks WHERE project_id = ?', [id])
  run('DELETE FROM issues WHERE project_id = ?', [id])
}

// ---------- Packages ----------

export function insertPackage(pkg: PackageInfo): void {
  run(
    'INSERT INTO packages (id, project_id, name, type, source_path, version, mod_id) VALUES (?,?,?,?,?,?,?)',
    [pkg.id, pkg.projectId, pkg.name, pkg.type, pkg.sourcePath, pkg.version ?? '', pkg.modId ?? '']
  )
}

export function listPackages(projectId: string): PackageInfo[] {
  return rows<{
    id: string
    project_id: string
    name: string
    type: string
    source_path: string
    version: string
    mod_id: string
  }>('SELECT * FROM packages WHERE project_id = ?', [projectId]).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    type: r.type as PackageInfo['type'],
    sourcePath: r.source_path,
    version: r.version ?? '',
    modId: r.mod_id ?? ''
  }))
}

// ---------- Entries ----------

export function insertEntry(e: TranslationEntry): void {
  run(
    `INSERT INTO translation_entries
     (id, project_id, package_id, key, source_text, target_text, original_target_text,
      status, selected, note, category, file_path, line_number, placeholders, issues,
      quality_score, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      e.id,
      e.projectId,
      e.packageId,
      e.key,
      e.sourceText,
      e.targetText ?? '',
      e.originalTargetText ?? '',
      e.status,
      e.selected ? 1 : 0,
      e.note ?? '',
      e.category ?? '',
      e.filePath ?? '',
      e.lineNumber ?? 0,
      JSON.stringify(e.placeholders ?? []),
      JSON.stringify(e.issues ?? []),
      e.qualityScore ?? null,
      e.updatedAt ?? now()
    ]
  )
}

export function insertEntries(entries: TranslationEntry[]): void {
  const d = requireDb()
  d.run('BEGIN TRANSACTION')
  try {
    for (const e of entries) {
      d.run(
        `INSERT INTO translation_entries
         (id, project_id, package_id, key, source_text, target_text, original_target_text,
          status, selected, note, category, file_path, line_number, placeholders, issues,
          quality_score, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          e.id,
          e.projectId,
          e.packageId,
          e.key,
          e.sourceText,
          e.targetText ?? '',
          e.originalTargetText ?? '',
          e.status,
          e.selected ? 1 : 0,
          e.note ?? '',
          e.category ?? '',
          e.filePath ?? '',
          e.lineNumber ?? 0,
          JSON.stringify(e.placeholders ?? []),
          JSON.stringify(e.issues ?? []),
          e.qualityScore ?? null,
          e.updatedAt ?? now()
        ]
      )
    }
    d.run('COMMIT')
  } catch (err) {
    d.run('ROLLBACK')
    throw err
  }
  persist()
}

export function listEntries(projectId: string): TranslationEntry[] {
  const rs = rows<EntryRow>('SELECT * FROM translation_entries WHERE project_id = ? ORDER BY file_path, line_number, key', [
    projectId
  ])
  return rs.map(mapEntry)
}

export function getEntry(id: string): TranslationEntry | undefined {
  const r = row<EntryRow>('SELECT * FROM translation_entries WHERE id = ?', [id])
  return r ? mapEntry(r) : undefined
}

export function updateEntryTarget(id: string, targetText: string, status: EntryStatus): void {
  run('UPDATE translation_entries SET target_text = ?, status = ?, updated_at = ? WHERE id = ?', [
    targetText,
    status,
    now(),
    id
  ])
}

export function updateEntryStatus(id: string, status: EntryStatus): void {
  run('UPDATE translation_entries SET status = ?, updated_at = ? WHERE id = ?', [status, now(), id])
}

export function updateEntrySelected(id: string, selected: boolean): void {
  run('UPDATE translation_entries SET selected = ? WHERE id = ?', [selected ? 1 : 0, id])
}

export function updateEntryIssues(id: string, issues: TranslationIssue[], qualityScore: number | null): void {
  run('UPDATE translation_entries SET issues = ?, quality_score = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(issues),
    qualityScore,
    now(),
    id
  ])
}

export function clearEntryTarget(id: string): void {
  run(
    "UPDATE translation_entries SET target_text = '', status = 'pending', quality_score = NULL, updated_at = ? WHERE id = ?",
    [now(), id]
  )
}

export function clearAllTargets(projectId: string): void {
  run(
    "UPDATE translation_entries SET target_text = '', status = 'pending', quality_score = NULL, updated_at = ? WHERE project_id = ? AND status != 'builtin'",
    [now(), projectId]
  )
}

// ---------- Glossary ----------

export function insertGlossary(g: Omit<GlossaryEntry, 'id'>): GlossaryEntry {
  const id = randomUUID()
  run(
    'INSERT INTO glossary_entries (id, source, target, case_sensitive, package_type, note) VALUES (?,?,?,?,?,?)',
    [id, g.source, g.target, g.caseSensitive ? 1 : 0, g.packageType, g.note ?? '']
  )
  return { id, ...g }
}

export function listGlossary(): GlossaryEntry[] {
  return rows<{
    id: string
    source: string
    target: string
    case_sensitive: number
    package_type: string
    note: string
  }>('SELECT * FROM glossary_entries ORDER BY source').map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    caseSensitive: r.case_sensitive === 1,
    packageType: r.package_type as GlossaryEntry['packageType'],
    note: r.note ?? ''
  }))
}

export function updateGlossary(id: string, patch: Partial<Omit<GlossaryEntry, 'id'>>): void {
  const cur = row<GlossaryEntry & { case_sensitive?: number }>('SELECT * FROM glossary_entries WHERE id = ?', [id])
  if (!cur) return
  const source = patch.source ?? cur.source
  const target = patch.target ?? cur.target
  const cs = patch.caseSensitive ?? (cur.caseSensitive === true || (cur as { case_sensitive?: number }).case_sensitive === 1)
  const pt = patch.packageType ?? cur.packageType
  const note = patch.note ?? cur.note
  run(
    'UPDATE glossary_entries SET source=?, target=?, case_sensitive=?, package_type=?, note=? WHERE id = ?',
    [source, target, cs ? 1 : 0, pt, note, id]
  )
}

export function deleteGlossary(id: string): void {
  run('DELETE FROM glossary_entries WHERE id = ?', [id])
}

// ---------- Translation Memory ----------

export function lookupMemory(sourceText: string, targetCode = ''): MemoryEntry | undefined {
  const r = row<{
    id: string
    source_text: string
    target_text: string
    package_type: string
    target_code: string
    hit_count: number
    updated_at: string
  }>('SELECT * FROM translation_memory WHERE source_text = ? AND target_code = ?', [sourceText, targetCode])
  if (!r) return undefined
  return {
    id: r.id,
    sourceText: r.source_text,
    targetText: r.target_text,
    packageType: r.package_type as MemoryEntry['packageType'],
    targetCode: r.target_code ?? '',
    hitCount: r.hit_count,
    updatedAt: r.updated_at
  }
}

export function upsertMemory(sourceText: string, targetText: string, packageType: string, targetCode = ''): void {
  const existing = lookupMemory(sourceText, targetCode)
  if (existing) {
    run('UPDATE translation_memory SET target_text = ?, hit_count = hit_count + 1, updated_at = ? WHERE id = ?', [
      targetText,
      now(),
      existing.id
    ])
  } else {
    run(
      'INSERT INTO translation_memory (id, source_text, target_text, package_type, target_code, hit_count, updated_at) VALUES (?,?,?,?,?,1,?)',
      [randomUUID(), sourceText, targetText, packageType, targetCode, now()]
    )
  }
}

export function listMemory(): MemoryEntry[] {
  return rows<{
    id: string
    source_text: string
    target_text: string
    package_type: string
    target_code: string
    hit_count: number
    updated_at: string
  }>('SELECT * FROM translation_memory ORDER BY hit_count DESC').map((r) => ({
    id: r.id,
    sourceText: r.source_text,
    targetText: r.target_text,
    packageType: r.package_type as MemoryEntry['packageType'],
    targetCode: r.target_code ?? '',
    hitCount: r.hit_count,
    updatedAt: r.updated_at
  }))
}

export function deleteMemoryMany(ids: string[]): void {
  if (ids.length === 0) {
    run('DELETE FROM translation_memory')
    return
  }
  const placeholders = ids.map(() => '?').join(',')
  run(`DELETE FROM translation_memory WHERE id IN (${placeholders})`, ids)
}

// ---------- History ----------

export function addHistory(entryId: string, source: HistoryEntry['source'], value: string): HistoryEntry {
  const v = row<{ v: number }>('SELECT COALESCE(MAX(version),0) AS v FROM translation_history WHERE entry_id = ?', [entryId])
  const version = (v?.v ?? 0) + 1
  const id = randomUUID()
  const ts = now()
  run('INSERT INTO translation_history (id, entry_id, version, source, value, created_at) VALUES (?,?,?,?,?,?)', [
    id,
    entryId,
    version,
    source,
    value,
    ts
  ])
  return { id, entryId, version, source, value, createdAt: ts }
}

export function listHistory(entryId: string): HistoryEntry[] {
  return rows<{ id: string; entry_id: string; version: number; source: string; value: string; created_at: string }>(
    'SELECT * FROM translation_history WHERE entry_id = ? ORDER BY version ASC',
    [entryId]
  ).map((r) => ({
    id: r.id,
    entryId: r.entry_id,
    version: r.version,
    source: r.source as HistoryEntry['source'],
    value: r.value,
    createdAt: r.created_at
  }))
}

export interface HistoryWithKey extends HistoryEntry {
  key: string
}

export function listAllHistory(projectId: string): HistoryWithKey[] {
  return rows<{ id: string; entry_id: string; version: number; source: string; value: string; created_at: string; key: string }>(
    `SELECT h.id, h.entry_id, h.version, h.source, h.value, h.created_at, e.key
     FROM translation_history h JOIN translation_entries e ON h.entry_id = e.id
     WHERE e.project_id = ? ORDER BY h.created_at DESC LIMIT 1000`,
    [projectId]
  ).map((r) => ({
    id: r.id,
    entryId: r.entry_id,
    version: r.version,
    source: r.source as HistoryEntry['source'],
    value: r.value,
    createdAt: r.created_at,
    key: r.key
  }))
}

export function deleteHistoryMany(ids: string[]): void {
  if (ids.length === 0) {
    run('DELETE FROM translation_history')
    return
  }
  const placeholders = ids.map(() => '?').join(',')
  run(`DELETE FROM translation_history WHERE id IN (${placeholders})`, ids)
}

// ---------- Tasks ----------

export function createTask(projectId: string, type: string, total: number): TaskInfo {
  const id = randomUUID()
  const ts = now()
  const task: TaskInfo = {
    id,
    projectId,
    type,
    status: 'queued',
    progress: 0,
    total,
    done: 0,
    failed: 0,
    error: '',
    createdAt: ts,
    updatedAt: ts
  }
  run(
    'INSERT INTO translation_tasks (id, project_id, type, status, progress, total, done, failed, error, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, projectId, type, task.status, task.progress, total, 0, 0, '', ts, ts]
  )
  return task
}

export function updateTask(
  id: string,
  patch: Partial<Pick<TaskInfo, 'status' | 'progress' | 'total' | 'done' | 'failed' | 'error'>>
): void {
  const cur = row<
    TaskInfo & { total: number; done: number; failed: number; progress: number; status: string; error: string }
  >('SELECT * FROM translation_tasks WHERE id = ?', [id])
  if (!cur) return
  const status = patch.status ?? cur.status
  const total = patch.total ?? cur.total
  const done = patch.done ?? cur.done
  const failed = patch.failed ?? cur.failed
  const progress = patch.progress ?? (total > 0 ? done / total : 0)
  const error = patch.error ?? cur.error
  run('UPDATE translation_tasks SET status=?, progress=?, total=?, done=?, failed=?, error=?, updated_at=? WHERE id=?', [
    status,
    progress,
    total,
    done,
    failed,
    error,
    now(),
    id
  ])
}

export function getTask(id: string): TaskInfo | undefined {
  const r = row<TaskInfo & { created_at: string; updated_at: string }>(
    'SELECT * FROM translation_tasks WHERE id = ?',
    [id]
  )
  if (!r) return undefined
  return {
    id: r.id,
    projectId: r.projectId,
    type: r.type,
    status: r.status,
    progress: r.progress,
    total: r.total,
    done: r.done,
    failed: r.failed ?? 0,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function listTasks(projectId: string): TaskInfo[] {
  return rows<TaskInfo & { created_at: string; updated_at: string }>(
    'SELECT * FROM translation_tasks WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  ).map((r) => ({
    id: r.id,
    projectId: r.projectId,
    type: r.type,
    status: r.status,
    progress: r.progress,
    total: r.total,
    done: r.done,
    failed: r.failed ?? 0,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))
}

// ---------- Issues ----------

export function insertIssue(projectId: string, entryId: string, type: string, message: string): void {
  run('INSERT INTO issues (id, project_id, entry_id, type, message, resolved) VALUES (?,?,?,?,?,0)', [
    randomUUID(),
    projectId,
    entryId,
    type,
    message
  ])
}

export function clearProjectIssues(projectId: string): void {
  run('DELETE FROM issues WHERE project_id = ?', [projectId])
}

export function listIssues(projectId: string): IssueRecord[] {
  return rows<{ id: string; project_id: string; entry_id: string; type: string; message: string; resolved: number }>(
    'SELECT * FROM issues WHERE project_id = ? ORDER BY resolved ASC, type ASC',
    [projectId]
  ).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    entryId: r.entry_id,
    type: r.type,
    message: r.message,
    resolved: r.resolved === 1
  }))
}

export function setIssueResolved(id: string, resolved: boolean): void {
  run('UPDATE issues SET resolved = ? WHERE id = ?', [resolved ? 1 : 0, id])
}

// ---------- Settings ----------

export function getSetting(key: string): string | undefined {
  const r = row<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return r?.value
}

export function setSetting(key: string, value: string): void {
  run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value
  ])
}

export function loadAppSettings(): AppSettings {
  const theme = (getSetting('theme') as AppSettings['theme']) || 'system'
  return { theme }
}

export function saveAppSettings(s: AppSettings): void {
  setSetting('theme', s.theme)
}

export function closeDatabase(): void {
  if (saveTimer) clearTimeout(saveTimer)
  void persistNow()
}
