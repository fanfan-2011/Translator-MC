import { useEffect, useRef } from 'react'
import type { CheckResult } from '../../api'
import { useUpdateFlow } from './UpdateFlow'

/**
 * 更新弹窗流程的**顶层宿主**。
 *
 * 为什么需要它：流程弹窗是 `fixed inset-0` 的整屏遮罩，如果挂在设置弹窗内部，
 * 会被设置弹窗的层叠上下文/动画变换影响（被压住或裁掉）。宿主固定挂在 `App` 顶层，
 * 任何位置都能通过 `requestUpdateFlow(result)` 唤起同一份实现。
 */
const listeners = new Set<(r: CheckResult) => void>()
let pending: CheckResult | null = null

/** 请求打开「检查到更新！」流程；宿主尚未挂载时先缓存，挂载后立即打开 */
export function requestUpdateFlow(info: CheckResult): void {
  if (listeners.size === 0) {
    pending = info
    return
  }
  for (const fn of listeners) fn(info)
}

export function UpdateFlowHost(): JSX.Element | null {
  const flow = useUpdateFlow()
  const ref = useRef(flow)
  ref.current = flow

  useEffect(() => {
    const fn = (r: CheckResult): void => ref.current.open(r)
    listeners.add(fn)
    if (pending) {
      const p = pending
      pending = null
      ref.current.open(p)
    }
    return () => {
      listeners.delete(fn)
    }
  }, [])

  return flow.modals
}
