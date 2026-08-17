// Standalone self-test for the pure backend modules (no Electron dependency).
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
import { openVfs } from '../src/main/package/vfs'
import { detectPackage } from '../src/main/package/detector'
import { extractEntries } from '../src/main/package/extractor'
import { parseContent } from '../src/main/parser'
import { validatePlaceholders, validateFormatCodes } from '../src/main/translation/validate'
import { parseTranslations, parseLLMJson } from '../src/main/llm/json-repair'

let passed = 0
let failed = 0

function assert(cond: boolean, name: string): void {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}`)
  }
}

async function main(): Promise<void> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'gl-test-'))

  console.log('\n[1] 解析器 (Parser)')
  const json = parseContent('{"a.b": "Hello", "c": "World"}', 'en_us.json')
  assert(json.length === 2 && json[0].key === 'a.b' && json[0].value === 'Hello', 'JSON 平铺解析')
  const json5 = parseContent('{ a: "x", // comment\n b: "y", }', 'en_us.json5')
  assert(json5.length === 2, 'JSON5 (注释/尾逗号) 解析')
  const lang = parseContent('# comment\nitem.diamond=Diamond\nitem.iron=Iron Ingot\n', 'en_US.lang')
  assert(lang.length === 2 && lang[0].value === 'Diamond', 'lang/properties 解析')
  const yml = parseContent('a:\n  b: hello\nc: world\n', 'x.yml')
  assert(yml.length === 2 && yml[0].key === 'a.b', 'YAML 解析')

  console.log('\n[2] 类型识别 (Detector)')
  // mod jar
  const modJar = new AdmZip()
  modJar.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ id: 'testmod', name: 'Test Mod', version: '1.0.0' })))
  modJar.addFile('assets/testmod/lang/en_us.json', Buffer.from(JSON.stringify({ 'item.test': 'Test Item', 'block.test': 'Test Block' })))
  const modPath = join(dir, 'testmod.jar')
  modJar.writeZip(modPath)
  const modVfs = (await openVfs(modPath)).vfs
  const modDet = detectPackage(modVfs)
  assert(modDet.type === 'mod', `Mod 识别 (fabric.mod.json) → ${modDet.type}`)
  assert(modDet.modId === 'testmod' && modDet.name === 'Test Mod', 'Mod 元数据提取')

  // resourcepack
  const rpJar = new AdmZip()
  rpJar.addFile('pack.mcmeta', Buffer.from(JSON.stringify({ pack: { pack_format: 34, description: 'Test RP' } })))
  rpJar.addFile('assets/minecraft/lang/en_us.json', Buffer.from(JSON.stringify({ 'item.test': 'Test' })))
  const rpPath = join(dir, 'rp.zip')
  rpJar.writeZip(rpPath)
  const rpDet = detectPackage((await openVfs(rpPath)).vfs)
  assert(rpDet.type === 'resourcepack', `Resource Pack 识别 → ${rpDet.type}`)

  // shader
  const shJar = new AdmZip()
  shJar.addFile('shaders/post/bloom.frag', Buffer.from('// frag'))
  shJar.addFile('shaders/lang/en_US.lang', Buffer.from('option.bloom=Bloom'))
  const shPath = join(dir, 'shader.zip')
  shJar.writeZip(shPath)
  const shDet = detectPackage((await openVfs(shPath)).vfs)
  assert(shDet.type === 'shader', `Shader 识别 → ${shDet.type}`)

  console.log('\n[3] 语言文件提取 (Extractor)')
  const extJar = new AdmZip()
  extJar.addFile(
    'assets/testmod/lang/en_us.json',
    Buffer.from(JSON.stringify({ 'item.diamond': 'Diamond', 'item.iron': 'Iron Ingot', 'gui.done': 'Done' }))
  )
  extJar.addFile(
    'assets/testmod/lang/zh_cn.json',
    Buffer.from(JSON.stringify({ 'item.diamond': '钻石', 'item.iron': '铁锭' }))
  )
  const extPath = join(dir, 'ext.jar')
  extJar.writeZip(extPath)
  const extVfs = (await openVfs(extPath)).vfs
  const out = extractEntries(extVfs, 'p', 'pkg', 'mod')
  assert(out.entries.length === 3, `提取 3 条条目 → ${out.entries.length}`)
  assert(out.builtinCount === 2, `识别已有中文 2 条 → ${out.builtinCount}`)
  const diamond = out.entries.find((e) => e.key === 'item.diamond')
  assert(diamond?.status === 'builtin' && diamond.targetText === '钻石', 'builtin 条目正确填充译文')
  const done = out.entries.find((e) => e.key === 'gui.done')
  assert(done?.status === 'pending' && done.targetText === '', '未翻译条目为 pending')
  const placeholders = out.entries.find((e) => e.key === 'item.iron')
  assert(placeholders?.placeholders.length === 0, '占位符提取（无占位符）')

  console.log('\n[4] 校验 (Validation)')
  const ph = validatePlaceholders('Found %s items in %1$s', '在 %1$s 中找到 %s 个物品')
  assert(ph.length === 0, '占位符保留 → 通过')
  const ph2 = validatePlaceholders('Found %s items', '找到了物品')
  assert(ph2.length === 1 && ph2[0].type === 'placeholder', '占位符丢失 → 报错')
  const fc = validateFormatCodes('§aGreen text', '绿色文字')
  assert(fc.length === 1 && fc[0].type === 'format_code', '格式代码丢失 → 告警')

  console.log('\n[5] LLM JSON 解析 (json-repair)')
  const repaired = parseTranslations('```json\n{"translations":{"a":"甲","b":"乙"}}\n```')
  assert(repaired['a'] === '甲' && repaired['b'] === '乙', 'Markdown 代码块包裹的 JSON 解析')
  const trailing = parseTranslations('{"translations":{"a":"甲",}}')
  assert(trailing['a'] === '甲', '尾逗号 JSON 修复')
  const direct = parseTranslations('{"a":"甲","b":"乙"}')
  assert(direct['a'] === '甲', '扁平 map 直接解析')
  const nested = parseLLMJson('prefix { "x": 1 } suffix')
  assert((nested as { x: number }).x === 1, '从混合文本中提取 JSON')

  console.log(`\n结果: ${passed} 通过, ${failed} 失败\n`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('测试崩溃:', e)
  process.exit(1)
})
