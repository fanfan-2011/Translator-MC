import { useState } from 'react'
import type { CheckResult, UpdatePrefs, UpdateProgressState } from '../../api'
import { UpdateInfoModal } from './UpdateInfoModal'
import { UpdateOptionsModal } from './UpdateOptionsModal'
import { UpdateProgressWindow } from './UpdateProgressWindow'

/**
 * 更新界面的**测试脚手架**（不是产品功能）。
 *
 * 用途：把三个更新弹窗按设计稿逐帧比对。因为正式版里要"真的有更新"才会出现这些界面，
 * 而当前安装版本通常就是最新版，所以需要一个能直接渲染它们的地方。
 *
 * 触发方式（正常运行完全不可达，不会误触）：
 *   `localStorage.setItem('tsm-demo', 'update')` 后刷新；清除该标记即恢复。
 * 入口在 `main.tsx` 里判断。
 */
const FAKE_INFO: CheckResult = {
  current: '2.0.0',
  available: true,
  best: {
    source: 'github',
    tag: 'v2.1.0',
    version: '2.1.0',
    changelog: [
      'Translator MC v2.1.0 — 新增「更新」功能',
      '',
      '本次新增软件内更新：',
      '- 更新检查同时支持 GitHub 与 GitCode 两个来源，任意一端有新版本都会在左下角提示',
      '- 每次启动自动检查更新，之后每 10 分钟自动检查一次',
      '- 可选择更新来源（GitHub / GitCode）与安装包类型（exe 安装版 / zip 便携版）',
      '- 更新前可导出备份用户配置（设置、术语表、翻译记忆）',
      '- 软件内下载安装包：显示进度、速度、已下载 / 总大小，支持断点续传与取消',
      '- 下载完成后自动打开安装包或压缩包',
      '',
      '---',
      '',
      'Translator MC v2.1.0 — in-app updater',
      '',
      '- Update check covers both GitHub and GitCode',
      '- Auto check on start-up and every 10 minutes',
      '- Choose source and installer type, remember the choice',
      '- Optional config backup before updating',
      '- In-app download with progress, speed and resume support',
      '- Opens the installer or the zip when the download finishes'
    ].join('\n'),
    commit: '9fdfd256',
    prerelease: false,
    publishedAt: '2026-10-06T00:00:00Z',
    pageUrl: 'https://github.com/fanfan-2011/Translator-MC/releases/tag/v2.1.0',
    assets: {
      exe: { name: 'Translator-MC-Setup-win-2.1.0.exe', url: 'https://example.invalid/a.exe', size: 134323782 },
      zip: { name: 'Translator-MC-mobile-win-2.1.0.zip', url: 'https://example.invalid/a.zip', size: 177567358 }
    },
    channel: 'api'
  },
  perSource: { github: null, gitcode: null },
  errors: [],
  checkedAt: Date.now()
}
FAKE_INFO.perSource.github = FAKE_INFO.best ?? null
FAKE_INFO.perSource.gitcode = { ...(FAKE_INFO.best as NonNullable<CheckResult['best']>), source: 'gitcode', commit: 'ba835d55' }

const FAKE_PREFS: UpdatePrefs = { source: 'gitcode', kind: 'exe', remember: true, backup: true, lastCheckAt: Date.now() }

const FAKE_PROGRESS: UpdateProgressState = {
  phase: 'downloading',
  source: 'github',
  kind: 'exe',
  version: '2.1.0',
  received: 64 * 1024 * 1024,
  total: 160 * 1024 * 1024,
  percent: 40,
  speed: 12 * 1024 * 1024
}

type Step = 'info' | 'options' | 'progress' | 'progress-done'

export function UpdateDemo(): JSX.Element {
  const [step, setStep] = useState<Step>('info')
  const [dark, setDark] = useState(false)

  const steps: { key: Step; label: string }[] = [
    { key: 'info', label: '详情 58:84' },
    { key: 'options', label: '配置 63:325' },
    { key: 'progress', label: '进度 63:282' },
    { key: 'progress-done', label: '完成态' }
  ]

  return (
    <div className={`flex h-full w-full flex-col gap-4 overflow-auto p-6 ${dark ? 'dark' : ''}`}>
      <div className="flex items-center gap-2">
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(s.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              step === s.key ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink"
        >
          切换 {dark ? '亮色' : '暗色'} 背景
        </button>
        <span className="text-xs text-muted">（更新弹窗配色应保持不变）</span>
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center">
        {step === 'info' ? (
          <div className="relative h-[760px] w-[560px]">
            <UpdateInfoModal info={FAKE_INFO} onCancel={() => undefined} onProceed={() => setStep('options')} />
          </div>
        ) : null}

        {step === 'options' ? (
          <div className="relative h-[560px] w-[560px]">
            <UpdateOptionsModal
              info={FAKE_INFO}
              prefs={FAKE_PREFS}
              onCancel={() => undefined}
              onConfirm={() => undefined}
            />
          </div>
        ) : null}

        {step === 'progress' || step === 'progress-done' ? (
          /* 尺寸与真实进度窗一致：440×244（设计稿标 417×202，但那个 frame 装不下自己的内容，见 main/update/windows.ts） */
          <div className="h-[244px] w-[440px] overflow-hidden rounded-updwin">
            <UpdateProgressWindow
              demoState={
                step === 'progress'
                  ? FAKE_PROGRESS
                  : { ...FAKE_PROGRESS, phase: 'done', received: FAKE_PROGRESS.total, percent: 100, speed: 0 }
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
