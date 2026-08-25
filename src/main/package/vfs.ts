import AdmZip from 'adm-zip'
import { promises as fs } from 'fs'
import { join, relative, resolve, sep } from 'path'

// Unified view over a .jar / .zip archive or a directory.
export interface VFS {
  listFiles(): string[]
  readText(path: string): string
  readBuffer(path: string): Buffer
  has(path: string): boolean
}

export interface VFSOpenResult {
  vfs: VFS
  kind: 'jar' | 'zip' | 'dir'
}

// 校验压缩包条目名：拒绝绝对路径、盘符、空段和 .. 逃逸段（防 zip-slip / 恶意条目名进入系统）
export function isSafeEntryName(name: string): boolean {
  const norm = name.replace(/\\/g, '/')
  if (norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) return false
  return !norm.split('/').some((p) => p === '..' || p === '')
}

// 目录模式下的 jar 内文件路径用 <jar>!<entry> 表示（如 mods/x.jar!assets/xenon/lang/en_us.lang）
const JAR_SPLIT = '!'

function splitJarPath(path: string): { jarPath: string; entry: string } | null {
  const i = path.indexOf(JAR_SPLIT)
  if (i > 0) return { jarPath: path.slice(0, i), entry: path.slice(i + 1) }
  return null
}

// 语言候选：位于 */lang/ 目录且扩展名是文本格式的条目。只解包这些，避免把字节码/贴图全捞出来。
const LANG_EXTS = new Set(['lang', 'json', 'json5', 'properties', 'yaml', 'yml', 'toml'])
function isLangCandidate(entryName: string): boolean {
  const n = entryName.replace(/\\/g, '/').toLowerCase()
  if (!n.includes('/lang/')) return false
  const ext = n.slice(n.lastIndexOf('.') + 1)
  return LANG_EXTS.has(ext)
}

class ZipVFS implements VFS {
  private files: Set<string>
  constructor(private zip: AdmZip) {
    this.files = new Set(
      zip
        .getEntries()
        .filter((e) => !e.isDirectory && isSafeEntryName(e.entryName))
        .map((e) => e.entryName.replace(/\\/g, '/'))
    )
  }
  listFiles(): string[] {
    return [...this.files]
  }
  has(path: string): boolean {
    return this.files.has(path)
  }
  readText(path: string): string {
    if (!isSafeEntryName(path)) throw new Error(`非法压缩包路径: ${path}`)
    return this.zip.readAsText(path, 'utf8')
  }
  readBuffer(path: string): Buffer {
    if (!isSafeEntryName(path)) throw new Error(`非法压缩包路径: ${path}`)
    const b = this.zip.readFile(path)
    if (!b) throw new Error(`文件不存在于压缩包: ${path}`)
    return b as Buffer
  }
}

// 目录模式：确保解析后的路径仍位于 root 内（防 .. 逃逸）
function safeJoin(root: string, p: string): string {
  const resolved = resolve(root, p)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`非法路径: ${p}`)
  }
  return resolved
}

class DirVFS implements VFS {
  private files: string[] = []
  private jarCache = new Map<string, AdmZip>()
  constructor(private root: string) {}

  async init(): Promise<void> {
    const { normal, jars } = await walk(this.root)
    const all = [...normal]
    for (const j of jars) {
      let zip: AdmZip
      try {
        zip = this.openJar(j)
      } catch {
        continue
      }
      let entries: string[] = []
      try {
        entries = zip.getEntries().map((e) => e.entryName)
      } catch {
        continue
      }
      for (const entryName of entries) {
        if (entryName.endsWith('/')) continue // directories
        if (!isSafeEntryName(entryName)) continue
        if (!isLangCandidate(entryName)) continue
        all.push(`${j}${JAR_SPLIT}${entryName}`)
      }
    }
    this.files = all
  }

  private openJar(relPath: string): AdmZip {
    let zip = this.jarCache.get(relPath)
    if (!zip) {
      zip = new AdmZip(safeJoin(this.root, relPath))
      this.jarCache.set(relPath, zip)
    }
    return zip
  }

  listFiles(): string[] {
    return this.files
  }
  has(path: string): boolean {
    return this.files.includes(path)
  }

  readText(path: string): string {
    const sp = splitJarPath(path)
    if (sp) {
      if (!isSafeEntryName(sp.entry)) throw new Error(`非法压缩包路径: ${path}`)
      return this.openJar(sp.jarPath).readAsText(sp.entry, 'utf8')
    }
    return require('fs').readFileSync(safeJoin(this.root, path), 'utf8')
  }
  readBuffer(path: string): Buffer {
    const sp = splitJarPath(path)
    if (sp) {
      if (!isSafeEntryName(sp.entry)) throw new Error(`非法压缩包路径: ${path}`)
      const b = this.openJar(sp.jarPath).readFile(sp.entry)
      if (!b) throw new Error(`文件不存在于压缩包: ${sp.entry}`)
      return b as Buffer
    }
    return require('fs').readFileSync(safeJoin(this.root, path))
  }
}

interface WalkResult {
  normal: string[]
  jars: string[]
}

async function walk(dir: string): Promise<WalkResult> {
  const normal: string[] = []
  const jars: string[] = []
  async function rec(d: string): Promise<void> {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) await rec(full)
      else if (e.isFile()) {
        const rel = relative(dir, full).replace(/\\/g, '/')
        if (/\.(jar|zip)$/i.test(rel)) jars.push(rel)
        else normal.push(rel)
      }
    }
  }
  await rec(dir)
  return { normal, jars }
}

export async function openVfs(sourcePath: string): Promise<VFSOpenResult> {
  const lower = sourcePath.toLowerCase()
  if (lower.endsWith('.jar') || lower.endsWith('.zip')) {
    const zip = new AdmZip(sourcePath)
    return { vfs: new ZipVFS(zip), kind: lower.endsWith('.jar') ? 'jar' : 'zip' }
  }
  const stat = await fs.stat(sourcePath)
  if (stat.isDirectory()) {
    const v = new DirVFS(sourcePath)
    await v.init()
    return { vfs: v, kind: 'dir' }
  }
  throw new Error(`不支持的文件类型: ${sourcePath}`)
}

export function fileName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1]
}
