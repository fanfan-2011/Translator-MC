import type { LLMConfig, ModelInfo } from '@shared/types'
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

class OpenAICompatibleProvider implements LLMProvider {
  id = 'openai-compatible'
  name = 'OpenAI Compatible'

  async listModels(config: LLMConfig): Promise<ModelInfo[]> {
    const base = normalizeEndpoint(config.endpoint)
    if (!base) return []
    const url = base.endsWith('/models') ? base : `${base}/models`
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
    const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`无法获取模型列表 (HTTP ${res.status})`)
    const json = (await res.json()) as { data?: { id: string }[]; models?: { id: string }[] }
    const list = json.data ?? json.models ?? []
    return list.map((m) => ({ id: m.id, name: m.id }))
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

    let res: Response
    try {
      const timeoutSignal = AbortSignal.timeout(config.timeout || 60000)
      // Combine the external cancel signal with the timeout signal (Chrome 116+).
      const signal = cancelSignal ? AbortSignal.any([cancelSignal, timeoutSignal]) : timeoutSignal
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e // 取消或超时，交上层判断
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('timeout')) throw new Error('请求超时')
      throw new Error(`网络错误: ${msg}`)
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error('API Key 无效或无权限')
    }
    if (res.status === 429) {
      throw new Error('请求过于频繁 (429)，已被限流')
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`AI 服务错误 (HTTP ${res.status})${text ? ': ' + text.slice(0, 200) : ''}`)
    }

    const json = (await res.json()) as {
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
