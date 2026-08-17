// 渲染新图标 SVG → PNG（512） + 横向版 → PNG
const sharp = require('sharp')
const fs = require('fs')

async function main() {
  // 主图标 512
  const png512 = await sharp(fs.readFileSync('build/icon.svg'), { density: 512 }).resize(512, 512).png().toBuffer()
  fs.writeFileSync('build/icon.png', png512)
  console.log('✓ icon.png', png512.length, 'bytes')

  // 横向版 1280x320
  const wide = await sharp(fs.readFileSync('build/logo-wide.svg'), { density: 320 }).resize(1280, 320).png().toBuffer()
  fs.writeFileSync('build/logo-wide.png', wide)
  console.log('✓ logo-wide.png', wide.length, 'bytes')

  // 各尺寸 PNG 供 ICO
  const fsx = require('fs')
  const path = require('path')
  const sizes = [256, 128, 64, 48, 32, 24, 16]
  fsx.mkdirSync('build/icon-tmp', { recursive: true })
  for (const s of sizes) {
    const b = await sharp(png512).resize(s, s).png().toBuffer()
    fsx.writeFileSync(path.join('build/icon-tmp', `icon-${s}.png`), b)
  }
  console.log('✓ 多尺寸 PNG 就绪')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
