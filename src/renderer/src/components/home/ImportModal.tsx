import { useEffect, useState } from 'react'
import { api, type DetectedPreview } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Modal, Spinner } from '../ui'
import { PACKAGE_LABEL } from '../../lib/status'

export function ImportModal({ paths, onClose }: { paths: string[]; onClose: () => void }): JSX.Element {
  const [previews, setPreviews] = useState<DetectedPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toastMsg = useApp((s) => s.toastMsg)
  const loadProjects = useApp((s) => s.loadProjects)
  const openProject = useApp((s) => s.openProject)
  const targetCode = useApp((s) => s.llmConfig.targetLanguage) || 'zh_cn'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
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
  }, [paths, targetCode])

  const doImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await api.importFiles(paths, undefined, undefined, targetCode)
      await loadProjects()
      onClose()
      await openProject(result.projectId)
      const { entryCount, builtinCount, packageCount } = result.stats
      toastMsg(`已导入 ${packageCount} 个内容包，提取 ${entryCount} 条文本${builtinCount > 0 ? `（自带中文 ${builtinCount} 条）` : ''}`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setImporting(false)
    }
  }

  const totalEntries = previews.reduce((s, p) => s + p.entryCount, 0)
  const totalBuiltin = previews.reduce((s, p) => s + p.builtinCount, 0)

  return (
    <Modal open onClose={onClose} title="导入内容包" width="max-w-3xl">
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-slate-500">
          <Spinner className="h-5 w-5 text-primary-500" />
          正在分析文件结构…
        </div>
      ) : (
        <>
          {previews.length > 0 ? (
            <div className="space-y-3">
              {previews.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-slate-400">{p.sourcePath}</div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {PACKAGE_LABEL[p.type]}
                    </span>
                    <span className="text-slate-500">{p.entryCount} 条</span>
                    {p.builtinCount > 0 ? (
                      <span className="rounded-md bg-teal-100 px-2 py-0.5 text-teal-700">自带中文 {p.builtinCount}</span>
                    ) : null}
                  </div>
                </div>
              ))}

              {totalBuiltin > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  检测到内容包已包含 {totalBuiltin} 条中文翻译，将标记为「自带中文」且默认不覆盖。你可随时在设置中选择重新翻译。
                </div>
              ) : null}

              {error ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">未能识别任何可导入的内容包</div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose} disabled={importing}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void doImport()} disabled={importing || previews.length === 0}>
              {importing ? (
                <>
                  <Spinner className="h-4 w-4" /> 导入中…
                </>
              ) : (
                `导入 ${totalEntries} 条文本`
              )}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
