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
  constructor(private root: string) {}
  async init(): Promise<void> {
    this.files = await walk(this.root)
  }
  listFiles(): string[] {
    return this.files
  }
  has(path: string): boolean {
    return this.files.includes(path)
  }
  readText(path: string): string {
    return require('fs').readFileSync(safeJoin(this.root, path), 'utf8')
  }
  readBuffer(path: string): Buffer {
    return require('fs').readFileSync(safeJoin(this.root, path))
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
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
      else if (e.isFile()) out.push(relative(dir, full).replace(/\\/g, '/'))
    }
  }
  await rec(dir)
  return out
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
