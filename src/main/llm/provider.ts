import type { LLMConfig, ModelInfo } from '@shared/types'
import { explainNetError, httpRequest } from '../update/http'
import { logger } from '../logger'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMProvider {
  id: string
  name: string
  listModels(config: LLMConfig): Promise<ModelInfo[]>
  chat(config: LLMConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string>
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

/**
 * 统一出口：LLM 请求走 Electron 的 net（与更新模块同一个出口）。
 * 以前这里是 Node 的 fetch —— 配了系统代理、服务跑在局域网另一台机器、或需要系统证书库的
 * 环境会直接 `TypeError: fetch failed`，用户完全看不懂；而且报错里没有任何可照做的信息。
 */
function toRequestError(e: unknown, signal?: AbortSignal): Error {
  // 取消保持 AbortError 语义：translate / review 的重试逻辑靠它判断是不是用户主动取消
  if (signal?.aborted) return new DOMException('已取消', 'AbortError')
  return new Error(explainNetError(e))
}

function jsonBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('接口返回的不是 JSON —— 请确认 Endpoint 是 OpenAI 兼容地址（通常以 /v1 结尾）')
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  id = 'openai-compatible'
  name = 'OpenAI Compatible'

  async listModels(config: LLMConfig): Promise<ModelInfo[]> {
    const base = normalizeEndpoint(config.endpoint)
    if (!base) return []
    const url = base.endsWith('/models') ? base : `${base}/models`
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`

    let res
    try {
      res = await httpRequest(url, {
        method: 'GET',
        headers,
        idleTimeoutMs: 20000,
        connectTimeoutMs: 20000
      })
    } catch (e) {
      throw toRequestError(e)
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`API Key 无效或无权限 (HTTP ${res.status})`)
    }
    if (res.status < 200 || res.status >= 300) {
      const detail = res.body.toString('utf8').trim().slice(0, 200)
      throw new Error(`无法获取模型列表 (HTTP ${res.status})${detail ? ': ' + detail : ''}`)
    }

    const json = jsonBody(res.body.toString('utf8')) as {
      data?: { id: string }[]
      models?: { id: string }[]
    }
    const list = json.data ?? json.models ?? []
    return list.filter((m) => m && typeof m.id === 'string').map((m) => ({ id: m.id, name: m.id }))
  }

  async chat(config: LLMConfig, messages: ChatMessage[], cancelSignal?: AbortSignal): Promise<string> {
    const base = normalizeEndpoint(config.endpoint)
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`

    const body = {
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      stream: false
    }

    const timeoutMs = config.timeout || 60000
    let res
    try {
      res = await httpRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        idleTimeoutMs: timeoutMs,
        // 模型「思考」时首字节可能很晚，连接阶段不能沿用下载的 10s 兜底
        connectTimeoutMs: timeoutMs,
        signal: cancelSignal
      })
    } catch (e) {
      throw toRequestError(e, cancelSignal)
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error('API Key 无效或无权限')
    }
    if (res.status === 429) {
      throw new Error('请求过于频繁 (429)，已被限流')
    }
    if (res.status < 200 || res.status >= 300) {
      const text = res.body.toString('utf8').trim().slice(0, 200)
      throw new Error(`AI 服务错误 (HTTP ${res.status})${text ? ': ' + text : ''}`)
    }

    const json = jsonBody(res.body.toString('utf8')) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('AI 返回内容为空')
    return content
  }
}

const providers: LLMProvider[] = [new OpenAICompatibleProvider()]

export function getProvider(id: string): LLMProvider {
  return providers.find((p) => p.id === id) ?? providers[0]
}

// Route a chat request through the right provider based on config.
export async function llmChat(config: LLMConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const provider = getProvider(config.provider)
  logger.debug(`LLM 请求 → ${provider.name} (${config.model})`)
  return provider.chat(config, messages, signal)
}

export async function llmListModels(config: LLMConfig): Promise<ModelInfo[]> {
  const provider = getProvider(config.provider)
  return provider.listModels(config)
}
