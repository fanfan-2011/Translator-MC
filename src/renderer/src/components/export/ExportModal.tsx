import { useEffect, useState } from 'react'
import type { ExportOptions, ExportResult } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Checkbox, Modal, Spinner } from '../ui'

export function ExportModal(): JSX.Element {
  const open = useApp((s) => s.exportOpen)
  const setOpen = useApp((s) => s.setExportOpen)
  const projectId = useApp((s) => s.currentProjectId)
  const toastMsg = useApp((s) => s.toastMsg)
  const targetCode = useApp((s) => s.llmConfig.targetLanguage) || 'zh_cn'

  const [kind, setKind] = useState<ExportOptions['kind']>('resourcepack')
  const [skipBuiltin, setSkipBuiltin] = useState(false)
  const [checking, setChecking] = useState(false)
  const [preCheck, setPreCheck] = useState<{ count: number; messages: string[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [projectName, setProjectName] = useState('localized-resource-pack')

  useEffect(() => {
    if (!projectId) return
    void api.getProject(projectId).then((p) => {
      if (p?.name) setProjectName(p.name.replace(/[\\\\/:*?"<>|]/g, '_'))
    })
  }, [projectId])

  const runPreCheck = async (): Promise<void> => {
    if (!projectId) return
    setChecking(true)
    setPreCheck(null)
    try {
      setPreCheck(await api.exportPreCheck(projectId))
    } finally {
      setChecking(false)
    }
  }

  const doExport = async (): Promise<void> => {
    if (!projectId) return
    setExporting(true)
    setResult(null)
    try {
      const options: ExportOptions = { kind, skipBuiltin, targetLang: targetCode }
      if (kind === 'resourcepack') {
        const path = await api.chooseExportPath(`${projectName}transistor.zip`, 'zip')
        if (!path) {
          setExporting(false)
          return
        }
        setResult(await api.exportSave(projectId, options, path))
      } else {
        setResult(await api.exportSave(projectId, options))
      }
    } catch (e) {
      toastMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="导出" width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            onClick={() => setKind('resourcepack')}
            className={`flex-1 rounded-lg border-2 p-4 text-left transition-colors ${
              kind === 'resourcepack'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-medium text-slate-800 dark:text-slate-100">方案 A：资源包</div>
            <div className="mt-1 text-xs text-slate-500">导出 localized-resource-pack.zip，作为汉化资源包使用</div>
          </button>
          <button
            onClick={() => setKind('jar')}
            className={`flex-1 rounded-lg border-2 p-4 text-left transition-colors ${
              kind === 'jar'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-medium text-slate-800 dark:text-slate-100">方案 B：修改后的 Jar</div>
            <div className="mt-1 text-xs text-slate-500">导出 mod-localized.jar（绝不覆盖原文件）</div>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Checkbox checked={skipBuiltin} onChange={setSkipBuiltin} />
          跳过「自带中文」条目（仅导出本次翻译的新内容）
        </label>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void runPreCheck()} disabled={checking}>
            {checking ? <Spinner className="h-3.5 w-3.5" /> : null} 导出前检查
          </Button>
          {preCheck ? (
            <span className={`text-sm ${preCheck.count > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {preCheck.count > 0 ? `发现 ${preCheck.count} 个问题` : '检查通过，无问题'}
            </span>
          ) : null}
        </div>

        {preCheck && preCheck.messages.length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {preCheck.messages.map((m, i) => (
              <div key={i} className="py-0.5">
                • {m}
              </div>
            ))}
          </div>
        ) : null}

        {result ? (
          <div
            className={`rounded-lg p-3 text-sm ${
              result.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
            }`}
          >
            {result.ok ? `导出成功：${result.outputPath}` : `导出失败：${result.error}`}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button onClick={() => setOpen(false)}>关闭</Button>
          <Button variant="primary" onClick={() => void doExport()} disabled={exporting || !projectId}>
            {exporting ? <Spinner className="h-4 w-4" /> : null}
            {kind === 'resourcepack' ? '导出资源包' : '导出修改后的 Jar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
