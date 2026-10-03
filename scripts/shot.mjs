// 开发用截图工具：连到已启动的 Electron 渲染层（CDP），把页面截图/执行脚本。
// 用法：
//   node scripts/shot.mjs <out.png> [--eval "<js>"] [--wait 800] [--port 9222] [--full]
// 需要应用以 --remote-debugging-port=9222 启动：
//   npx electron . --remote-debugging-port=9222 --user-data-dir=<临时目录>
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const out = args[0] ?? 'shot.png'
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? def : (args[i + 1] ?? true)
}
const port = Number(flag('port', 9222))
const waitMs = Number(flag('wait', 700))
const evalJs = flag('eval', null)
const full = args.includes('--full')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!res.ok) throw new Error(`CDP 列表失败: HTTP ${res.status}`)
  return res.json()
}

// 极简 CDP 客户端（Node 内置 WebSocket）
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时: ${method}`))
        }
      }, 30000)
    })
  }
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', (e) => reject(new Error(`WS 连接失败: ${e.message ?? e.type}`)), {
        once: true
      })
    })
    return new Cdp(ws)
  }
}

const list = await targets()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.error('找不到 page 目标。当前目标：')
  console.error(list.map((t) => `${t.type} ${t.title} ${t.url}`).join('\n'))
  process.exit(2)
}

const cdp = await Cdp.connect(page.webSocketDebuggerUrl)
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await sleep(waitMs)

if (evalJs) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: evalJs,
    awaitPromise: true,
    returnByValue: true
  })
  console.log('eval →', JSON.stringify(r.result?.value ?? r.result?.description ?? null))
  await sleep(waitMs)
}

const shot = await cdp.send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: !!full
})
writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log(`saved ${out} (${Buffer.from(shot.data, 'base64').length} bytes) from ${page.url}`)
process.exit(0)
