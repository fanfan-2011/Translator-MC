import { useEffect, useState } from 'react'
import { Download, Monitor, Moon, Sun, Upload, Zap } from 'lucide-react'
import { PROVIDER_PRESETS, TARGET_LANGUAGES, type LLMConfig, type ModelInfo } from '@shared/types'
import { api } from '../../api'
import { requestUpdateFlow } from '../update/UpdateFlowHost'
import { useApp } from '../../stores/app'
import {
  Button,
  Checkbox,
  Collapsible,
  Field,
  Input,
  Modal,
  SectionCard,
  SegmentedControl,
  Select,
  Slider,
  Spinner,
  Tooltip
} from '../ui'
import { HiddenStateIcon, RefreshIcon, VisibleStateIcon } from '../icons'

/**
 * 设置 —— 信息架构按「接口配置 / 翻译偏好 / 高级设置（折叠）/ 外观」四块组织：
 * 常用项常驻可见，批处理与限速参数收进默认折叠的高级设置，减轻视觉负担。
 * 视觉全部走 design/UI-SPEC.md 的语义令牌（不写死颜色、不写 dark: 变体），
 * 字段级说明统一收进标签旁的 ? Tooltip，不再用输入框下方的长灰字。
 * 配置项与后端接口（api.getLlmConfig / setLlmConfig / listModels、setSettings、setTheme）
 * 与重构前完全一致，没有增删任何字段或调用。
 */

/**
 * Temperature 的滑块范围取 0–2：这个值在 `main/llm/provider.ts` 里是**直接透传给模型接口**的，
 * OpenAI 兼容协议普遍允许 0–2。限制到 0–1 等于凭空削掉一个重构前就存在的能力
 * （老界面的数字输入框就是 min=0 / max=2），所以这里只做「输入合法性」收敛，不收缩能力。
 */
const TEMP_MIN = 0
const TEMP_MAX = 2
const TEMP_STEP = 0.05

/** 仅兜住脏值（NaN / 负数 / 超过协议上限），任何合法取值原样保留 */
const clampTemp = (v: number): number =>
  Math.max(TEMP_MIN, Math.min(TEMP_MAX, Number.isFinite(v) ? v : 0.7))

/** 0.7 / 0.75 这样显示，不补多余的 0 */
const formatTemp = (v: number): string => String(Number(clampTemp(v).toFixed(2)))

export function SettingsModal(): JSX.Element {
  const open = useApp((s) => s.settingsOpen)
  const setOpen = useApp((s) => s.setSettingsOpen)
  const llmConfig = useApp((s) => s.llmConfig)
  const theme = useApp((s) => s.theme)
  const setTheme = useApp((s) => s.setTheme)
  const toastMsg = useApp((s) => s.toastMsg)
  // ---- v2.1.0：检查更新（需求 11）+ 配置导出 / 导入（需求 4、5）----
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [configBusy, setConfigBusy] = useState(false)

  const checkUpdateNow = async (): Promise<void> => {
    setCheckingUpdate(true)
    try {
      const r = await api.checkUpdate()
      if (r.best) {
        // 关掉设置弹窗，让顶层更新流程（详情 → 配置）独占界面
        setOpen(false)
        requestUpdateFlow(r)
      } else {
        toastMsg(`已是最新版本（当前 ${r.current}）`, 'info')
      }
    } catch (e) {
      toastMsg(`检查更新失败：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const doExportConfig = async (): Promise<void> => {
    setConfigBusy(true)
    try {
      const r = await api.exportConfig()
      if (r.cancelled) return
      if (!r.ok) {
        toastMsg(r.error ?? '导出配置失败', 'error')
        return
      }
      const c = r.counts
      toastMsg(
        `配置已导出：术语表 ${c?.glossary ?? 0} 条、翻译记忆 ${c?.memory ?? 0} 条${
          c?.apiKeyIncluded ? `，API Key 为${c.apiKeyEncrypted ? '本机加密' : '未加密'}形式` : ''
        }`,
        'success'
      )
    } finally {
      setConfigBusy(false)
    }
  }

  const doImportConfig = async (): Promise<void> => {
    setConfigBusy(true)
    try {
      const r = await api.importConfig()
      if (r.cancelled) return
      if (!r.ok) {
        toastMsg(r.error ?? '导入配置失败', 'error')
        return
      }
      toastMsg(
        `配置已导入：设置 ${r.settingsApplied?.length ?? 0} 项、术语 +${r.glossaryAdded ?? 0}、记忆 ${
          r.memoryUpserted ?? 0
        }${r.glossarySkipped ? `（跳过重复 ${r.glossarySkipped}）` : ''}`,
        'success'
      )
      if (r.warnings?.length) toastMsg(r.warnings[0], 'info')
      // 让界面立刻反映刚导入的配置
      try {
        const cfg = (await api.getLlmConfig()) as LLMConfig
        setForm(cfg)
        const s = (await api.getSettings()) as { theme?: 'light' | 'dark' | 'system' }
        if (s?.theme) setTheme(s.theme)
      } catch {
        /* 刷新失败不影响导入结果 */
      }
    } finally {
      setConfigBusy(false)
    }
  }

  const [form, setForm] = useState<LLMConfig>(llmConfig)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (open) setForm({ ...llmConfig, temperature: clampTemp(llmConfig.temperature) })
  }, [open, llmConfig])

  const patch = (p: Partial<LLMConfig>): void => setForm((f) => ({ ...f, ...p }))

  const pickProvider = (id: string): void => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === id)
    patch({ provider: id, endpoint: preset?.endpoint ?? form.endpoint })
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
        patch({ model: list[0].id })
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

  const testConnection = async (): Promise<void> => {
    if (!form.endpoint) {
      toastMsg('请先填写 API Endpoint', 'error')
      return
    }
    if (!form.model) {
      toastMsg('请先填写模型名称', 'error')
      return
    }
    setTesting(true)
    try {
      const list = await api.listModels(form)
      if (list.some((m) => m.id === form.model)) {
        toastMsg(`连接成功：模型 ${form.model} 可用`, 'success')
      } else if (list.length > 0) {
        toastMsg(`接口连通，返回 ${list.length} 个模型；未包含 ${form.model}，请确认模型名`, 'info')
      } else {
        toastMsg('接口有响应，但未返回模型列表（可能未实现 /models 接口）', 'info')
      }
    } catch (e) {
      toastMsg(`连接失败：${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const save = async (): Promise<void> => {
    const next = { ...form, temperature: clampTemp(form.temperature) }
    await api.setLlmConfig(next)
    useApp.setState({ llmConfig: next })
    setOpen(false)
    toastMsg('设置已保存', 'success')
  }

  const num = (v: number): number => (Number.isFinite(v) ? v : 0)

  const advancedSummary = `Batch ${form.batchSize} · 并发 ${form.concurrency} · 间隔 ${form.requestInterval}ms · 重试 ${form.maxRetries} · 超时 ${form.timeout}ms`

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="设置"
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="primary" onClick={() => void save()}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ① 接口配置 —— 核心区 */}
        <SectionCard
          title="接口配置"
          subtitle="兼容 OpenAI 协议的服务"
          action={
            <Button size="sm" variant="soft" disabled={testing} onClick={() => void testConnection()}>
              {testing ? <Spinner className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" strokeWidth={2} />}
              {testing ? '测试中…' : '测试连接'}
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field label="Provider">
              <Select value={form.provider} onChange={pickProvider}>
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="模型" tooltip="点右侧「刷新」从接口拉取可用模型列表；也可以直接手填模型名。">
              {/* 复合控件：输入框 + 刷新按钮同框 */}
              <div className="flex h-[30px] items-stretch overflow-hidden rounded-input border border-line-2 bg-surface transition-colors focus-within:border-accent">
                <input
                  list="llm-model-list"
                  value={form.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  placeholder="选择或输入模型名称"
                  className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none"
                />
                <button
                  type="button"
                  title="刷新模型列表"
                  aria-label="刷新模型列表"
                  disabled={loadingModels}
                  onClick={() => void refreshModels()}
                  className="flex w-8 shrink-0 items-center justify-center border-l border-line text-[color:var(--tsm-toggle-icon)] transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingModels ? <Spinner className="h-3.5 w-3.5" /> : <RefreshIcon className="h-4 w-4" />}
                </button>
              </div>
              <datalist id="llm-model-list">
                {models.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
              {models.length > 0 ? (
                <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
                  {models.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded-input px-1.5 py-1 text-xs text-ink-3 transition-colors hover:bg-hover"
                    >
                      <Checkbox checked={form.model === m.id} onChange={() => patch({ model: m.id })} />
                      <span className="truncate-1">{m.id}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </Field>

            <Field
              label="API Endpoint"
              tooltip="兼容 OpenAI 协议的接口地址，通常以 /v1 结尾，例如 https://api.example.com/v1。"
              className="col-span-2"
            >
              <Input
                value={form.endpoint}
                onChange={(e) => patch({ endpoint: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </Field>

            <Field
              label="API Key"
              tooltip="使用系统安全存储（safeStorage）加密后入库，不会写进日志或文件。"
              className="col-span-2"
            >
              <div className="flex h-[30px] items-stretch overflow-hidden rounded-input border border-line-2 bg-surface transition-colors focus-within:border-accent">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => patch({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none"
                />
                <button
                  type="button"
                  title={showKey ? '隐藏' : '显示'}
                  aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                  onClick={() => setShowKey(!showKey)}
                  className="flex w-8 shrink-0 items-center justify-center border-l border-line text-[color:var(--tsm-toggle-icon)] transition-colors hover:bg-hover"
                >
                  {showKey ? <VisibleStateIcon className="h-4 w-4" /> : <HiddenStateIcon className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* ② 翻译偏好 —— 常用区 */}
        <SectionCard title="翻译偏好" subtitle="每次翻译都会用到">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field label="目标语言" tooltip="翻译到的语言。导入、翻译、导出统一使用这一项。">
              <Select value={form.targetLanguage} onChange={(v) => patch({ targetLanguage: v })}>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Temperature"
              tooltip="采样随机性：越低越稳定保守，越高越发散。取值范围 0 – 2（部分服务商上限更低）；翻译任务建议 0.2 – 0.7。"
            >
              <div className="flex h-[30px] items-center">
                <Slider
                  value={form.temperature}
                  min={TEMP_MIN}
                  max={TEMP_MAX}
                  step={TEMP_STEP}
                  onChange={(v) => patch({ temperature: v })}
                  format={formatTemp}
                  className="w-full"
                />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* ③ 高级设置 —— 默认收起，收起时在右侧显示当前值摘要 */}
        <Collapsible title="高级设置" subtitle="批量 / 并发 / 限速 / 超时" summary={advancedSummary}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field label="Batch Size" tooltip="每次请求打包的条目数。过大容易触发模型输出截断。">
              <Input
                type="number"
                min="1"
                value={form.batchSize}
                onChange={(e) => patch({ batchSize: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="并发数" tooltip="同时进行的请求数。过高可能被服务端限流（429）。">
              <Input
                type="number"
                min="1"
                value={form.concurrency}
                onChange={(e) => patch({ concurrency: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="请求间隔（毫秒）" tooltip="相邻两次请求的最小间隔，用于主动限速。">
              <Input
                type="number"
                min="0"
                value={form.requestInterval}
                onChange={(e) => patch({ requestInterval: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="最大重试次数" tooltip="单条请求失败后的重试次数；重试仍失败才计入「失败」。">
              <Input
                type="number"
                min="0"
                value={form.maxRetries}
                onChange={(e) => patch({ maxRetries: num(parseInt(e.target.value, 10)) })}
              />
            </Field>
            <Field label="超时（毫秒）" tooltip="单次请求的超时时间。批量翻译建议不低于 30000。">
              <Input
                type="number"
                min="1000"
                value={form.timeout}
                onChange={(e) => patch({ timeout: num(parseInt(e.target.value, 1000)) })}
              />
            </Field>
          </div>
        </Collapsible>

        {/* ④ 外观 —— 不属于翻译配置，单独一小块；逻辑与原来完全一致 */}
        <SectionCard title="外观" subtitle="立即生效">
          <div className="flex items-center gap-3">
            <SegmentedControl
              value={theme}
              onChange={setTheme}
              showLabels
              options={[
                { value: 'light', label: '亮色', icon: <Sun className="h-3.5 w-3.5" strokeWidth={1.7} /> },
                { value: 'dark', label: '暗色', icon: <Moon className="h-3.5 w-3.5" strokeWidth={1.7} /> },
                {
                  value: 'system',
                  label: '跟随系统',
                  icon: <Monitor className="h-3.5 w-3.5" strokeWidth={1.7} />
                }
              ]}
            />
            <Tooltip content="主题写入 settings.theme，与侧边栏底部的主题切换共用同一份配置。" />
          </div>
        </SectionCard>

        {/* ⑤ 更新与配置 —— 需求 11（检查更新）+ 需求 4、5（导出 / 导入配置）*/}
        <SectionCard title="更新与配置" subtitle="检查新版本，或备份 / 恢复你的配置">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size="sm" variant="soft" disabled={checkingUpdate} onClick={() => void checkUpdateNow()}>
              {checkingUpdate ? <Spinner className="h-3.5 w-3.5" /> : <RefreshIcon className="h-3.5 w-3.5" />}
              {checkingUpdate ? '检查中…' : '检查更新'}
            </Button>
            <Button size="sm" variant="soft" disabled={configBusy} onClick={() => void doExportConfig()}>
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              导出配置
            </Button>
            <Button size="sm" variant="soft" disabled={configBusy} onClick={() => void doImportConfig()}>
              <Upload className="h-3.5 w-3.5" strokeWidth={2} />
              导入配置
            </Button>
            <Tooltip content="配置包含：设置（含本机加密的 API Key）、术语表、翻译记忆；不含项目与翻译条目。导入前会自动备份当前配置。" />
          </div>
        </SectionCard>
      </div>
    </Modal>
  )
}
