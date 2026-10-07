// 开发脚本：把源目录的代码镜像到 git 副本（AGENT.md 第 3 节第 1 步）。
// 只处理代码目录，**绝不触碰**第 4 节禁区里的用户维护文件：
//   README.md / README.EN.md / updatelog.md / package-lock.json / screenshots/ / .git
// 用法：node scripts/sync-to-copy.mjs [--dry]
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const SRC = 'D:/Translator-MC/GameLocalizer'
const DST = 'D:/Translator-MC/GameLocalizer-GitHub'
// 本次改版只镜像代码目录。help/、build/、test-files/ 存在与本次改动无关的历史漂移，
// 未经确认不动它们（其中 build/wrapper/{bin,obj} 是 MSBuild 中间产物，本就不该提交）。
const MIRROR = ['src', 'scripts', 'help']
const FILES = [
  'electron.vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'package.json',
  '.npmrc'
  // 注意：**不要**把「使用说明.md」放进来。
  // 它由用户在副本里维护（副本是精简版、源目录还是旧长版），曾经列在这里，
  // 结果每次同步都静默覆盖掉用户手改的内容（已踩两次）。
]
const DRY = process.argv.includes('--dry')
const log = { added: [], updated: [], deleted: [], kept: [] }

async function listDir(dir, base = dir) {
  const out = []
  for (const name of await readdir(dir)) {
    const abs = join(dir, name)
    const s = await stat(abs)
    if (s.isDirectory()) out.push(...(await listDir(abs, base)))
    else out.push(relative(base, abs))
  }
  return out
}

async function mirrorDir(srcDir, dstDir) {
  const srcFiles = new Set(await listDir(srcDir))
  if (existsSync(dstDir)) {
    for (const rel of await listDir(dstDir)) {
      if (!srcFiles.has(rel)) {
        log.deleted.push(join(relative(DST, dstDir), rel))
        if (!DRY) await rm(join(dstDir, rel), { force: true })
      }
    }
  }
  for (const rel of srcFiles) {
    const from = join(srcDir, rel)
    const to = join(dstDir, rel)
    if (!existsSync(to)) log.added.push(join(relative(DST, dstDir), rel))
    else {
      const [a, b] = await Promise.all([stat(from), stat(to)])
      if (a.size === b.size) log.kept.push(rel)
      else log.updated.push(join(relative(DST, dstDir), rel))
    }
    if (!DRY) {
      await mkdir(dirname(to), { recursive: true })
      await cp(from, to, { force: true })
    }
  }
}

for (const dir of MIRROR) {
  const srcDir = join(SRC, dir)
  if (existsSync(srcDir)) await mirrorDir(srcDir, join(DST, dir))
}
for (const f of FILES) {
  const from = join(SRC, f)
  if (!existsSync(from)) continue
  const to = join(DST, f)
  if (!existsSync(to)) log.added.push(f)
  else {
    const [a, b] = await Promise.all([stat(from), stat(to)])
    a.size === b.size ? log.kept.push(f) : log.updated.push(f)
  }
  if (!DRY) await cp(from, to, { force: true })
}

const show = (t, arr) => {
  if (!arr.length) return
  console.log(`\n${t} (${arr.length}):`)
  arr.slice(0, 40).forEach((x) => console.log('  ' + x))
  if (arr.length > 40) console.log(`  … 另有 ${arr.length - 40} 个`)
}
console.log(`同步 ${SRC} → ${DST}${DRY ? '（dry-run）' : ''}`)
show('新增', log.added)
show('修改', log.updated)
show('删除', log.deleted)
console.log(`\n未变化: ${log.kept.length} 个文件`)
