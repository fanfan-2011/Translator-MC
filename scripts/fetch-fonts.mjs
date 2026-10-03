// 一次性开发脚本：把设计稿用到的字体（Inter / Roboto Mono / Anonymous Pro）的 latin 子集
// 下载到 src/renderer/src/assets/fonts/ 并生成 fonts.css，供 @font-face 自托管引用。
// 运行：node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/renderer/src/assets/fonts')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const FAMS = [
  { css: 'Inter:wght@400;500;600;700', family: 'Inter', slug: 'inter' },
  { css: 'Roboto+Mono:wght@400;500', family: 'Roboto Mono', slug: 'roboto-mono' },
  { css: 'Anonymous+Pro:wght@400;700', family: 'Anonymous Pro', slug: 'anonymous-pro' }
]
// 只需要 latin / latin-ext：中文走系统字体回退（与设计稿在 Figma 中的渲染一致）
const KEEP = new Set(['latin', 'latin-ext'])

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

await mkdir(outDir, { recursive: true })
const faces = []

for (const fam of FAMS) {
  const css = await (await get(`https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`)).text()
  // 每个 @font-face 块前一行是 /* 子集名 */ 注释
  const blocks = css.split('@font-face').slice(1)
  let comments = [...css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\//g)].map((m) => m[1])
  let ci = 0
  for (const block of blocks) {
    const subset = comments[ci++] ?? 'latin'
    if (!KEEP.has(subset)) continue
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1]
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1]
    if (!weight || !url) continue
    const file = `${fam.slug}-${weight}-${subset}.woff2`
    const buf = Buffer.from(await (await get(url)).arrayBuffer())
    await writeFile(join(outDir, file), buf)
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim()
    faces.push({ family: fam.family, weight, file, range, bytes: buf.length })
    console.log(`saved ${file} (${buf.length} bytes)`)
  }
}

const cssOut = `/* 由 scripts/fetch-fonts.mjs 生成 —— 对应 Figma 设计稿使用的字体，请勿手改。 */
${faces
  .map(
    (f) => `@font-face {
  font-family: '${f.family}';
  font-style: normal;
  font-weight: ${f.weight};
  font-display: swap;
  src: url('./${f.file}') format('woff2');
  unicode-range: ${f.range};
}`
  )
  .join('\n\n')}
`
await writeFile(join(outDir, 'fonts.css'), cssOut)
console.log(`\n${faces.length} faces -> ${outDir}`)
