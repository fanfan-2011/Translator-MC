import type { LogLine } from '@shared/types'

const buffer: LogLine[] = []
const MAX = 2000
let listeners: ((line: LogLine) => void)[] = []

function push(level: LogLine['level'], message: unknown): void {
  const line: LogLine = {
    ts: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  }
  buffer.push(line)
  if (buffer.length > MAX) buffer.shift()
  for (const cb of listeners) {
    try {
      cb(line)
    } catch {
      /* ignore */
    }
  }
  const fn =
    level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  fn(`[${level}] ${line.message}`)
}

export const logger = {
  debug: (m: unknown): void => push('DEBUG', m),
  info: (m: unknown): void => push('INFO', m),
  warn: (m: unknown): void => push('WARN', m),
  error: (m: unknown): void => push('ERROR', m),
  getLogs: (): LogLine[] => [...buffer],
  clear: (): void => {
    buffer.length = 0
  },
  onLog: (cb: (line: LogLine) => void): (() => void) => {
    listeners.push(cb)
    return () => {
      listeners = listeners.filter((x) => x !== cb)
    }
  }
}
