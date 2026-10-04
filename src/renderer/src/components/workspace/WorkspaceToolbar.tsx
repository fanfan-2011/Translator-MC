import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { targetLanguageName, TARGET_LANGUAGES } from '@shared/types'
import { useApp } from '../../stores/app'
import { api } from '../../api'
import { Button, Dropdown, Spinner } from '../ui'

/**
 * 操作栏 —— 设计稿 19:4：h71，底 #f8fafc，1px #e5e7eb 描边，圆角 18，
 * H gap16 pad 0/16。左侧「已翻译 N / M」chip + 动作组 + 分隔线 + 工具组，
 * 右侧「目标语言」选择器。
 */
export function WorkspaceToolbar({
  busy,
  onTranslate,
  onRetranslate,
  onReview,
  onClear
}: {
  busy: boolean
  onTranslate: () => void
  onRetranslate: () => void
  onReview: () => void
  onClear: () => void
}): JSX.Element {
  const entries = useApp((s) => s.entries)
  const llmConfig = useApp((s) => s.llmConfig)
  const setExportOpen = useApp((s) => s.setExportOpen)
  const setIssueOpen = useApp((s) => s.setIssueOpen)
  const toastMsg = useApp((s) => s.toastMsg)

  const counts = useMemo(() => {
    let translated = 0
    for (const e of entries) if (e.targetText) translated++
    return { translated, total: entries.length }
  }, [entries])

  const aiReady = !!llmConfig.endpoint && !!llmConfig.model
  const langCode = llmConfig.targetLanguage || 'zh_cn'

  const changeLang = async (code: string): Promise<void> => {
    const next = { ...llmConfig, targetLanguage: code }
    useApp.setState({ llmConfig: next })
    await api.setLlmConfig(next)
    toastMsg(`目标语言：${targetLanguageName(code)}`, 'success')
  }

  return (
    <div className="tsm-toolbar relative z-20 flex h-[71px] min-w-0 shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
      <span className="tsm-toolbar__chip inline-flex h-8 shrink-0 items-center rounded-full border border-primary-line bg-primary-soft px-3 text-sm font-semibold text-ink">
        已翻译 {counts.translated} / {counts.total}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="primary" disabled={busy} onClick={onTranslate}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
          AI精翻
        </Button>
        <Button disabled={busy} onClick={onRetranslate}>
          重新翻译
        </Button>
        <Button disabled={busy} onClick={onReview}>
          AI审校
        </Button>
        <Button disabled={busy} onClick={onClear}>
          清除译文
        </Button>
      </div>

      <div className="h-7 w-px shrink-0 rounded-full bg-line" />

      <div className="tsm-toolbar__aux flex shrink-0 items-center gap-2">
        <Button onClick={() => setExportOpen(true)}>导入/导出</Button>
        <Button onClick={() => setIssueOpen(true)}>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
          问题中心
        </Button>
      </div>
      <div className="min-w-0 flex-1" />

      {!aiReady ? (
        <button
          type="button"
          onClick={() => useApp.getState().setSettingsOpen(true)}
          className="shrink-0 rounded-full border border-line-3 px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover"
        >
          未配置 AI 服务
        </button>
      ) : null}

      <div className="flex h-[33px] shrink-0 items-center gap-2 rounded-full border border-line-3 bg-surface px-3 shadow-input">
        <span className="tsm-toolbar__lang-label shrink-0 text-sm font-medium text-muted">目标语言</span>
        <Dropdown
          value={langCode}
          shape="pill"
          align="right"
          className="-mr-1 border-0 bg-transparent"
          options={TARGET_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
          onChange={(v) => void changeLang(v)}
        />
      </div>
    </div>
  )
}
