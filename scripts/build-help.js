// 把 help/ 目录（index.html + images/）打包成 .tmhelp 混淆容器
// 格式: TMHP(4B 魔数) + ver(1B) + count(2B LE) + 重复[plen(2B)+path+len(4B)+XOR数据]
// XOR 密钥固定 0x5A，防止随意查看/修改（非强加密）
const fs = require('fs')
const path = require('path')

const HELP_DIR = path.join(__dirname, '..', 'help')
const OUT = path.join(HELP_DIR, 'help.tmhelp')
const KEY = 0x5a

function collect(dir, base) {
  const files = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.join(base, name).replace(/\\/g, '/')
    const st = fs.statSync(full)
    if (st.isDirectory()) files.push(...collect(full, rel))
    else if (!rel.endsWith('.tmhelp')) files.push({ path: rel, data: fs.readFileSync(full) })
  }
  return files
}

const files = collect(HELP_DIR, '')
const header = Buffer.from('TMHP', 'ascii')
const version = Buffer.from([1])
const count = Buffer.alloc(2)
count.writeUInt16LE(files.length)

const parts = [header, version, count]
for (const f of files) {
  const p = Buffer.from(f.path, 'utf8')
  const lenP = Buffer.alloc(2)
  lenP.writeUInt16LE(p.length)
  const lenD = Buffer.alloc(4)
  lenD.writeUInt32LE(f.data.length)
  const enc = Buffer.from(f.data)
  for (let i = 0; i < enc.length; i++) enc[i] ^= KEY
  parts.push(lenP, p, lenD, enc)
}

const out = Buffer.concat(parts)
fs.writeFileSync(OUT, out)
console.log(`✓ 已生成 ${OUT} (${out.length} 字节, ${files.length} 个文件)`)
console.log('  包含: ' + files.map((f) => f.path).join(', '))
