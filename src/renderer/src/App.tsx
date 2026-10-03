import { useEffect, useRef } from 'react'
import { consumeUserThemeSwitch, useApp } from './stores/app'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/layout/Sidebar'
import { Home } from './components/home/Home'
import { TranslationWorkspace } from './components/workspace/TranslationWorkspace'
import { GlossaryPanel } from './components/glossary/GlossaryPanel'
import { MemoryPanel } from './components/memory/MemoryPanel'
import { HistoryPanel } from './components/history/HistoryPanel'
import { LogsPanel } from './components/logs/LogsPanel'
import { SettingsModal } from './components/settings/SettingsModal'
import { ExportModal } from './components/export/ExportModal'
import { ImportModal } from './components/home/ImportModal'
import { IssuesPanel } from './components/issues/IssuesPanel'

/**
 * 运行时性能自适应：**只在用户主动切换主题后**采样 24 帧（由 store 的 setTheme 置位标记）。
 * 判定需要 ≥2 帧 >55ms 才算「这台机器扛不住」；一帧都不长则**撤销降级**（自愈，
 * 避免启动期一次误判就永久关掉动效 —— 那个 bug 正是这么来的：应用启动要加载
 * 48MB sql.js 库并渲染项目列表，启动期的长帧被误当成「切换时掉帧」）。
 */
const appStartedAt = performance.now()
let probing = false

function probeMotionBudget(): void {
  const root = document.documentElement
  if (probing) return
  probing = true
  let frames = 0
  let slow = 0
  let last = performance.now()
  const loop = (now: number): void => {
    const dt = now - last
    last = now
    if (dt > 55) slow += 1
    frames += 1
    if (frames < 24) {
      requestAnimationFrame(loop)
    } else {
      probing = false
      if (slow >= 2) {
        root.dataset.motionReduced = 'true'
      } else if (slow === 0) {
        delete root.dataset.motionReduced
      }
    }
  }
  requestAnimationFrame(loop)
}

function useTheme(): void {
  const theme = useApp((s) => s.theme)
  const firstApply = useRef(true)
  const switchTimer = useRef<number | null>(null)

  useEffect(() => {
    const apply = (): void => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      const root = document.documentElement
      const commit = (): void => {
        root.classList.toggle('dark', dark)
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const startVT = (
        document as unknown as {
          startViewTransition?: (cb: () => void) => { finished: Promise<void> }
        }
      ).startViewTransition

      if (firstApply.current || typeof startVT !== 'function' || reduced) {
        // 首帧 / 环境不支持 / 用户要求减少动效：瞬时切换
        commit()
      } else {
        // 视口过渡：合成器把「旧帧 → 新帧」两张快照交叉淡化 —— 既不是硬切，
        // 也不会像全文档颜色过渡那样逐帧重绘 500+ 元素（实测掉帧主因）。
        if (switchTimer.current !== null) window.clearTimeout(switchTimer.current)
        root.classList.add('theme-switching') // 关键：关闭逐元素过渡，让新帧快照捕获「最终配色」
        void root.offsetHeight
        const vt = startVT.call(document, commit)
        vt.finished.finally(() => {
          root.classList.remove('theme-switching')
          switchTimer.current = null
        })
        // 兜底：finished 万一不回调，别让过渡一直关着
        switchTimer.current = window.setTimeout(() => {
          root.classList.remove('theme-switching')
          switchTimer.current = null
        }, 900)
        // 只有用户主动切换才采样，且避开启动后的头 5 秒（启动渲染本身有长帧）
        if (consumeUserThemeSwitch() && performance.now() - appStartedAt > 5000) {
          window.setTimeout(probeMotionBudget, 900)
        }
      }
      firstApply.current = false
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])
}

function Toast(): JSX.Element | null {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  const mark = toast.kind === 'error' ? '!' : toast.kind === 'success' ? '✓' : 'i'
  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-card bg-[color:var(--tsm-ink)] px-4 py-2.5 text-sm text-[color:var(--tsm-surface)] shadow-update">
        <span className="font-machine text-xs opacity-80">{mark}</span>
        {toast.text}
      </div>
    </div>
  )
}

function MainContent(): JSX.Element {
  const view = useApp((s) => s.view)
  const projectId = useApp((s) => s.currentProjectId)

  switch (view) {
    case 'workspace':
      return projectId ? <TranslationWorkspace /> : <Home />
    case 'glossary':
      return <GlossaryPanel />
    case 'memory':
      return <MemoryPanel />
    case 'history':
      return <HistoryPanel />
    case 'logs':
      return <LogsPanel />
    case 'home':
    default:
      return <Home />
  }
}

export default function App(): JSX.Element {
  useTheme()
  const loadProjects = useApp((s) => s.loadProjects)
  const loadSettings = useApp((s) => s.loadSettings)
  const loadLlmConfig = useApp((s) => s.loadLlmConfig)
  const loadGlossary = useApp((s) => s.loadGlossary)

  useEffect(() => {
    void loadSettings()
    void loadLlmConfig()
    void loadProjects()
    void loadGlossary()
  }, [loadSettings, loadLlmConfig, loadProjects, loadGlossary])

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-bg text-ink">
      {/*
        液态玻璃折射滤镜：全局只定义一次，供 .tsm-glass__pill 的 backdrop-filter
        通过 url(#tsm-glass-refraction) 引用（Chromium 支持 backdrop-filter 引用 SVG 滤镜）。
        位移量很小（scale 5），只为在玻璃边缘产生轻微折射，不做夸张形变。
      */}
      <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute h-0 w-0">
        <filter
          id="tsm-glass-refraction"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014 0.022"
            numOctaves="2"
            seed="6"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.1" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* 主面板：白底、左上角圆角 18，与灰色外壳之间是设计稿实测的 1px 硬边界 */}
        <main className="min-w-0 flex-1 overflow-hidden rounded-tl-panel border-l border-t border-edge bg-surface dark:border-black/70">
          <MainContent />
        </main>
      </div>
      <SettingsModal />
      <ExportModal />
      <ImportModal />
      <IssuesPanel />
      <Toast />
    </div>
  )
}
