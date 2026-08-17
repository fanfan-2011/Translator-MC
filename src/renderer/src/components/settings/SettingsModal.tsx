import { useEffect, useState } from 'react'
import { PROVIDER_PRESETS, TARGET_LANGUAGES, type LLMConfig, type ModelInfo } from '@shared/types'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button, Field, Input, Modal, Select, Spinner } from '../ui'

export function SettingsModal(): JSX.Element {
  const open = useApp((s) => s.settingsOpen)
  const setOpen = useApp((s) => s.setSettingsOpen)
  const llmConfig = useApp((s) => s.llmConfig)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const toastMsg = useApp((s) => s.toastMsg)

  const [form, setForm] = useState<LLMConfig>(llmConfig)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) setForm(llmConfig)
  }, [open, llmConfig])

  const pickProvider = (id: string): void => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === id)
    setForm({ ...form, provider: id, endpoint: preset?.endpoint ?? form.endpoint })
  }

  const refreshModels = async (): Promise<void> => {
    if (!form.endpoint) {
      toastMsg('请先填写 API Endpoint', 'error')
      return
    }
    setLoadingModels(true)
    try {
      const list = await api.listModels(form)
      setModels(list)
      if (list.length > 0) {
        setForm({ ...form, model: list[0].id })
        toastMsg(`获取到 ${list.length} 个模型`, 'success')
      } else {
        toastMsg('未获取到模型，可手动输入', 'info')
      }
    } catch (e) {
      toastMsg(`无法获取模型列表：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setLoadingModels(false)
    }
  }

  const save = async (): Promise<void> => {
    await api.setLlmConfig(form)
    useApp.setState({ llmConfig: form })
    setOpen(false)
    toastMsg('设置已保存', 'success')
  }

  const num = (v: number): number => (Number.isFinite(v) ? v : 0)

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="设置" width="max-w-2xl">
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">AI 翻译服务</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider">
              <Select value={form.provider} onChange={pickProvider}>
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="API Endpoint">
              <Input
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </Field>
            <Field label="API Key" hint="使用系统安全存储加密保存">
              <div className="flex gap-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <Button size="sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? '隐藏' : '显示'}
                </Button>
              </div>
            </Field>
            <Field label="模型">
              <div className="flex gap-1">
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="模型名称"
                />
                <Button size="sm" onClick={() => void refreshModels()} disabled={loadingModels}>
                  {loadingModels ? <Spinner className="h-3.5 w-3.5" /> : '刷新'}
                </Button>
              </div>
            </Field>
            <Field label="目标语言" hint="翻译到的语言（导入/翻译/导出统一使用）">
              <Select value={form.targetLanguage} onChange={(v) => setForm({ ...form, targetLanguage: v })}>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Temperature">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: num(parseFloat(e.target.value)) })}
              />
            </Field>
            <Field label="Batch Size（每条请求的条目数）">
              <Input
                type="number"
                min="1"
                value={form.batchSize}
                onChange={(e) => setForm({ ...form, batchSize: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="并发数">
              <Input
                type="number"
                min="1"
                value={form.concurrency}
                onChange={(e) => setForm({ ...form, concurrency: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="请求间隔（毫秒）" hint="限速：相邻请求的最小间隔">
              <Input
                type="number"
                min="0"
                value={form.requestInterval}
                onChange={(e) => setForm({ ...form, requestInterval: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="最大重试次数">
              <Input
                type="number"
                min="0"
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="超时（毫秒）">
              <Input
                type="number"
                min="1000"
                value={form.timeout}
                onChange={(e) => setForm({ ...form, timeout: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
          </div>
          {models.length > 0 ? (
            <div className="mt-2 text-xs text-slate-400">
              可用模型：{models.map((m) => m.id).join(', ')}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">外观</h3>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-md px-4 py-1.5 text-sm ${
                  theme === t
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="primary" onClick={() => void save()}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
