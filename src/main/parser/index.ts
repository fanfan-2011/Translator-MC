import JSON5 from 'json5'
import yaml from 'js-yaml'
import TOML from '@iarna/toml'
import { logger } from '../logger'

export interface ParserResult {
  key: string
  value: string
}

export type ParserFn = (content: string, fileName: string) => ParserResult[]

// Flatten a nested object into dotted keys, keeping only string leaf values.
function flatten(obj: unknown, prefix = '', out: ParserResult[] = []): ParserResult[] {
  if (obj === null || obj === undefined) return out
  if (typeof obj === 'string') {
    out.push({ key: prefix, value: obj })
  } else if (typeof obj === 'number' || typeof obj === 'boolean') {
    out.push({ key: prefix, value: String(obj) })
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out)
    }
  }
  return out
}

const jsonParser: ParserFn = (content, _fileName) => {
  let obj: unknown
  try {
    obj = JSON.parse(content)
  } catch {
    // fall back to JSON5 (allows comments, trailing commas, single quotes)
    obj = JSON5.parse(content)
  }
  if (typeof obj !== 'object' || obj === null) return []
  return flatten(obj)
}

const json5Parser: ParserFn = (content) => {
  const obj = JSON5.parse(content)
  if (typeof obj !== 'object' || obj === null) return []
  return flatten(obj)
}

const propertiesParser: ParserFn = (content) => {
  const out: ParserResult[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    // unescape common escape sequences
    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\=/g, '=')
      .replace(/\\:/g, ':')
    out.push({ key, value })
  }
  return out
}

const langParser: ParserFn = propertiesParser

const yamlParser: ParserFn = (content) => {
  try {
    const obj = yaml.load(content)
    if (typeof obj !== 'object' || obj === null) return []
    return flatten(obj)
  } catch (e) {
    logger.warn(`YAML 解析失败: ${e}`)
    return []
  }
}

const tomlParser: ParserFn = (content) => {
  try {
    const obj = TOML.parse(content)
    if (typeof obj !== 'object' || obj === null) return []
    return flatten(obj)
  } catch (e) {
    logger.warn(`TOML 解析失败: ${e}`)
    return []
  }
}

function ext(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : ''
}

// Select a parser for the given file name.
export function pickParser(fileName: string): ParserFn {
  const e = ext(fileName)
  const base = fileName.toLowerCase()
  switch (e) {
    case 'json':
      return jsonParser
    case 'json5':
      return json5Parser
    case 'lang':
      return langParser
    case 'properties':
      return propertiesParser
    case 'yaml':
    case 'yml':
      return yamlParser
    case 'toml':
      return tomlParser
    default:
      if (base.includes('lang')) return langParser
      return propertiesParser
  }
}

export function parseContent(content: string, fileName: string): ParserResult[] {
  try {
    const parser = pickParser(fileName)
    return parser(content, fileName)
  } catch (e) {
    logger.warn(`解析 ${fileName} 失败: ${e}`)
    return []
  }
}

// Extract placeholder tokens (%s, %1$s, %d, ${name}, {name}, <player>, etc.)
export function extractPlaceholders(text: string): string[] {
  const patterns = [
    /%\d+\$[sdif]/g, // %1$s %2$d
    /%[sdif%]/g, // %s %d %f %%
    /\$\{[^}]+\}/g, // ${name}
    /\{[^}]+\}/g, // {name}
    /<[a-zA-Z_][^>]*>/g // <player>
  ]
  const set = new Set<string>()
  for (const p of patterns) {
    for (const m of text.match(p) ?? []) set.add(m)
  }
  return [...set]
}
