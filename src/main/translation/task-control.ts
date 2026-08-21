// Shared task control for long-running jobs (translate / review).
// A single global registry keyed by taskId, so pause / resume / cancel can
// target either a translation or a review task through the same functions.

export interface TaskControllerOptions {
  taskId: string
  onStateChange?: (status: 'running' | 'paused') => void
}

export class TaskController {
  readonly taskId: string
  private _cancel = false
  private _pause = false
  private pauseWaiters: (() => void)[] = []
  private onStateChange?: (status: 'running' | 'paused') => void

  constructor(opts: TaskControllerOptions) {
    this.taskId = opts.taskId
    this.onStateChange = opts.onStateChange
  }

  get cancelled(): boolean {
    return this._cancel
  }

  get paused(): boolean {
    return this._pause
  }

  // Blocks while the task is paused (unless it is also cancelled).
  async checkPause(): Promise<void> {
    while (this._pause && !this._cancel) {
      await new Promise<void>((resolve) => this.pauseWaiters.push(resolve))
    }
  }

  pause(): void {
    if (this._cancel) return
    this._pause = true
    this.onStateChange?.('paused')
  }

  resume(): void {
    if (!this._pause) return
    this._pause = false
    const waiters = this.pauseWaiters.splice(0)
    for (const w of waiters) w()
    this.onStateChange?.('running')
  }

  cancel(): void {
    if (this._cancel) return
    this._cancel = true
    this._pause = false
    const waiters = this.pauseWaiters.splice(0)
    for (const w of waiters) w()
  }
}

const registry = new Map<string, TaskController>()

export function registerTaskController(c: TaskController): void {
  registry.set(c.taskId, c)
}

export function unregisterTaskController(taskId: string): void {
  registry.delete(taskId)
}

export function getTaskController(taskId: string): TaskController | undefined {
  return registry.get(taskId)
}

export function pauseTask(taskId: string): boolean {
  const c = registry.get(taskId)
  if (!c) return false
  c.pause()
  return true
}

export function resumeTask(taskId: string): boolean {
  const c = registry.get(taskId)
  if (!c) return false
  c.resume()
  return true
}

export function cancelTask(taskId: string): boolean {
  const c = registry.get(taskId)
  if (!c) return false
  c.cancel()
  return true
}
