import { useState } from 'react'
import { api, type CheckResult, type UpdatePrefs } from '../../api'
import { UpdateInfoModal } from './UpdateInfoModal'
import { UpdateOptionsModal, type UpdateChoice } from './UpdateOptionsModal'

/**
 * 更新弹窗流程：详情（Figma 58:84）→ 配置（Figma 63:325）→ `update:start` 开始下载。
 *
 * 侧边栏卡片与设置界面的「检查更新」共用这一份实现，避免两套分支。
 * 用法：
 *   const flow = useUpdateFlow()
 *   ... <button onClick={async () => { const r = await api.checkUpdate(); if (r.best) flow.open(r) }}>
 *   {flow.modals}
 * 需求 11 的语义（用户裁决）：设置里的「检查更新」= 只查版本 + 拉取更新说明 → 弹「检查到更新！」；
 * 点弹窗里的「立即更新！」才进入选源/下载。
 */
export function useUpdateFlow(): {
  open: (info: CheckResult) => void
  close: () => void
  modals: JSX.Element | null
} {
  const [info, setInfo] = useState<CheckResult | null>(null)
  const [detail, setDetail] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [prefs, setPrefs] = useState<UpdatePrefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const close = (): void => {
    setDetail(false)
    setChoosing(false)
    setError(undefined)
  }

  const open = (result: CheckResult): void => {
    setError(undefined)
    setInfo(result)
    setDetail(true)
    void api.getUpdatePrefs().then(setPrefs)
  }

  const confirm = async (choice: UpdateChoice): Promise<void> => {
    setBusy(true)
    setError(undefined)
    const r = await api.startUpdate(choice)
    setBusy(false)
    if (r.ok) {
      // 主进程会隐藏主窗口、只留进度窗
      close()
      return
    }
    if (r.cancelled) return // 用户在「选择导出位置」点了取消 → 静默回到弹窗
    setError(r.error ?? '开始更新失败')
  }

  const modals = (
    <>
      {detail && info ? (
        <UpdateInfoModal
          info={info}
          onCancel={close}
          onProceed={() => {
            setDetail(false)
            setChoosing(true)
          }}
        />
      ) : null}

      {choosing && info ? (
        <UpdateOptionsModal
          info={info}
          prefs={prefs}
          busy={busy}
          error={error}
          onCancel={close}
          onConfirm={(c) => void confirm(c)}
        />
      ) : null}
    </>
  )

  return { open, close, modals }
}
