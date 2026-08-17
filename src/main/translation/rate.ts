export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Token-bucket-free, simple interval rate limiter.
export class RateLimiter {
  private last = 0
  constructor(private intervalMs: number) {}
  async wait(): Promise<void> {
    if (this.intervalMs <= 0) return
    const now = Date.now()
    const waitMs = Math.max(0, this.last + this.intervalMs - now)
    if (waitMs > 0) await sleep(waitMs)
    this.last = Date.now()
  }
}

// Counting semaphore to cap concurrent LLM requests.
export class Semaphore {
  private available: number
  private waiters: (() => void)[] = []
  constructor(max: number) {
    this.available = Math.max(1, max)
  }
  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve))
  }
  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
    } else {
      this.available++
    }
  }
}

export interface RetryOpts {
  maxRetries: number
  baseDelayMs: number
  onRetry?: (attempt: number, error: string) => void
}

// Exponential backoff retry: 1s, 2s, 4s, 8s ...
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt >= opts.maxRetries) break
      const delay = opts.baseDelayMs * Math.pow(2, attempt)
      opts.onRetry?.(attempt + 1, e instanceof Error ? e.message : String(e))
      await sleep(delay)
    }
  }
  throw lastErr
}
