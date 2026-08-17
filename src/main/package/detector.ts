import type { PackageType } from '@shared/types'
import type { VFS } from './vfs'

export interface DetectResult {
  type: PackageType
  name: string
  version: string
  modId: string
  evidence: string[]
}

const MOD_MARKERS = ['fabric.mod.json', 'quilt.mod.json', 'META-INF/mods.toml', 'mcmod.info', 'META-INF/neoforge.mods.toml']
const SHADER_MARKERS = ['shaders.properties', 'shaders/post/', 'shaders/program/', 'shaders/world0/']
const RESOURCEPACK_MARKERS = ['pack.mcmeta']

function anyFile(vfs: VFS, markers: string[]): string[] {
  const files = new Set(vfs.listFiles())
  const found: string[] = []
  for (const m of markers) {
    if (files.has(m)) found.push(m)
  }
  // Also match by directory prefix for shader dirs
  return found
}

function hasDir(vfs: VFS, dir: string): boolean {
  return vfs.listFiles().some((f) => f.startsWith(dir + '/'))
}

export function detectPackage(vfs: VFS, hint?: PackageType): DetectResult {
  const evidence: string[] = []
  let type: PackageType = 'unknown'

  const modMarkers = anyFile(vfs, MOD_MARKERS)
  if (modMarkers.length > 0) {
    type = 'mod'
    evidence.push(...modMarkers)
  } else if (hasDir(vfs, 'shaders') || anyFile(vfs, SHADER_MARKERS).length > 0) {
    type = 'shader'
    evidence.push('shaders/')
    const s = anyFile(vfs, SHADER_MARKERS)
    evidence.push(...s)
  } else if (anyFile(vfs, RESOURCEPACK_MARKERS).length > 0) {
    type = 'resourcepack'
    evidence.push('pack.mcmeta')
  }

  if (type === 'unknown' && hint && hint !== 'unknown') {
    type = hint
    evidence.push('(手动指定)')
  }

  let name = ''
  let version = ''
  let modId = ''

  if (vfs.has('fabric.mod.json') || vfs.has('quilt.mod.json')) {
    const f = vfs.has('fabric.mod.json') ? 'fabric.mod.json' : 'quilt.mod.json'
    try {
      const j = JSON.parse(vfs.readText(f)) as { id?: string; name?: string; version?: string }
      modId = j.id ?? ''
      name = j.name ?? ''
      version = j.version ?? ''
    } catch {
      /* ignore */
    }
  } else if (vfs.has('META-INF/mods.toml') || vfs.has('META-INF/neoforge.mods.toml')) {
    const f = vfs.has('META-INF/mods.toml') ? 'META-INF/mods.toml' : 'META-INF/neoforge.mods.toml'
    try {
      const txt = vfs.readText(f)
      const idM = txt.match(/modId\s*=\s*"([^"]+)"/)
      const nameM = txt.match(/displayName\s*=\s*"([^"]+)"/)
      const verM = txt.match(/version\s*=\s*"([^"]+)"/)
      modId = idM?.[1] ?? ''
      name = nameM?.[1] ?? ''
      version = verM?.[1] ?? ''
    } catch {
      /* ignore */
    }
  } else if (vfs.has('pack.mcmeta')) {
    try {
      const j = JSON.parse(vfs.readText('pack.mcmeta')) as { pack?: { description?: unknown } }
      const desc = j.pack?.description
      if (typeof desc === 'string') name = desc
      else if (desc && typeof desc === 'object') {
        name = (desc as { text?: string }).text ?? ''
      }
    } catch {
      /* ignore */
    }
  }

  if (!name) {
    // Fall back to a human-readable default
    name = type === 'mod' ? 'Minecraft Mod' : type === 'shader' ? 'Shader Pack' : type === 'resourcepack' ? 'Resource Pack' : '未知内容包'
  }

  return { type, name, version, modId, evidence }
}
