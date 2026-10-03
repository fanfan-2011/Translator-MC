import { useEffect, useState } from 'react'
import { api, type DetectedPreview } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Chip, Modal, Spinner } from '../ui'
import { PACKAGE_LABEL } from '../../lib/status'

/**
 * 导入弹窗 —— 由 store 驱动（任何地方调用 openImport(paths) 都会拉起它）。
 * 视觉按 UI-SPEC 第 6 节的弹窗模板：白底圆角 16 + 阴影 update，
 * 标题条 56px，内容区卡片化。
 */
export function ImportModal(): JSX.Element | null {
  const open = useApp((s) => s.importOpen)
  const paths = useApp((s) => s.importPaths)
  const setImportOpen = useApp((s) => s.setImportOpen)
  const toastMsg = useApp((s) => s.toastMsg)
  const loadProjects = useApp((s) => s.loadProjects)
  const openProject = useApp((s) => s.openProject)
  const targetCode = useApp((s) => s.llmConfig.targetLanguage) || 'zh_cn'

  const [previews, setPreviews] = useState<DetectedPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || paths.length === 0) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const out: DetectedPreview[] = []
      for (const p of paths) {
        try {
          const prev = await api.previewPackage(p, undefined, targetCode)
          if (!cancelled) out.push(prev)
        } catch (e) {
          if (!cancelled) setError(`${p}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      if (!cancelled) {
        setPreviews(out)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, paths, targetCode])

  if (!open) return null

  const close = (): void => {
    setPreviews([])
    setError(null)
    setImporting(false)
    setImportOpen(false)
  }

  const doImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await api.importFiles(paths, undefined, undefined, targetCode)
      await loadProjects()
      close()
      await openProject(result.projectId)
      const { entryCount, builtinCount, packageCount } = result.stats
      toastMsg(
        `已导入 ${packageCount} 个内容包，提取 ${entryCount} 条文本${
          builtinCount > 0 ? `（自带中文 ${builtinCount} 条）` : ''
        }`,
        'success'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setImporting(false)
    }
  }

  const totalEntries = previews.reduce((s, p) => s + p.entryCount, 0)
  const totalBuiltin = previews.reduce((s, p) => s + p.builtinCount, 0)

  return (
    <Modal
      open
      onClose={close}
      title="导入内容包"
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={close} disabled={importing}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => void doImport()}
            disabled={importing || previews.length === 0}
          >
            {importing ? (
              <>
                <Spinner className="h-4 w-4" /> 导入中…
              </>
            ) : (
              `导入 ${totalEntries} 条文本`
            )}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-muted">
          <Spinner className="h-5 w-5 text-accent" />
          正在分析文件结构…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {previews.length > 0 ? (
            previews.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-card border border-line bg-surface-2 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate-1 text-base font-semibold text-ink">{p.name}</div>
                  <div className="truncate-1 font-mono text-2xs text-muted-4">{p.sourcePath}</div>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <Chip>{PACKAGE_LABEL[p.type]}</Chip>
                  <span className="text-xs text-muted">{p.entryCount} 条</span>
                  {p.builtinCount > 0 ? (
                    <span className="inline-flex h-[19px] items-center rounded-full bg-[var(--tsm-st-human-bg)] px-2 text-2xs font-medium text-[var(--tsm-st-human-fg)]">
                      自带中文 {p.builtinCount}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-muted">未能识别任何可导入的内容包</div>
          )}

          {totalBuiltin > 0 ? (
            <div className="rounded-card border border-line p-3 text-sm text-[var(--tsm-st-attention-fg)]">
              检测到内容包已包含 {totalBuiltin} 条中文翻译，将标记为「自带翻译」且默认不覆盖。你可随时在设置中选择重新翻译。
            </div>
          ) : null}

          {error ? (
            <div className="rounded-card border border-line bg-danger-soft p-3 text-sm text-danger">{error}</div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
