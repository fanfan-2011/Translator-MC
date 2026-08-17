// 验证真实测试 mod 能被正确识别与提取
import { openVfs } from '../src/main/package/vfs'
import { detectPackage } from '../src/main/package/detector'
import { extractEntries } from '../src/main/package/extractor'

async function main(): Promise<void> {
  const path = 'test-files/test-adventure-mod.jar'
  const { vfs, kind } = await openVfs(path)
  console.log('打开方式:', kind)
  console.log('文件总数:', vfs.listFiles().length)

  const det = detectPackage(vfs)
  console.log('识别类型:', det.type, '| 名称:', det.name, '| modId:', det.modId, '| 版本:', det.version)
  console.log('识别依据:', det.evidence.join(', '))

  const out = extractEntries(vfs, 'p', 'pkg', det.type)
  console.log('提取条目:', out.entries.length)
  console.log('自带中文:', out.builtinCount)
  console.log('语言文件:', out.languageFiles)

  // 分类统计
  const cat = new Map<string, number>()
  for (const e of out.entries) cat.set(e.category, (cat.get(e.category) ?? 0) + 1)
  console.log('分类统计:', Object.fromEntries(cat))

  // 占位符/格式码覆盖检查
  const withPh = out.entries.filter((e) => e.placeholders.length > 0)
  console.log('含占位符的条目:', withPh.length)
  for (const e of withPh.slice(0, 5)) console.log('  例:', e.key, '→', e.placeholders.join(' '))

  const withFmt = out.entries.filter((e) => /§[0-9a-fk-or]/.test(e.sourceText))
  console.log('含格式代码的条目:', withFmt.length)
}

main().catch((e) => {
  console.error('验证失败:', e)
  process.exit(1)
})
