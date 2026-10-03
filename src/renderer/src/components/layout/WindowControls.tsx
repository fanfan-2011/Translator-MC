import { useEffect, useState } from 'react'
import { api } from '../../api'

/**
 * 三键（自绘窗口控制）—— 尺寸与图标几何取自设计稿 36:121：
 * 每键 46×22，图标 ~9×9，颜色 #59616b（--tsm-win-icon）。
 * 关闭键悬停用系统红 #e81123 + 白色图标。
 */
export function WindowControls(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void api.windowState().then(setMaximized)
    return api.onWindowState(setMaximized)
  }, [])

  return (
    <div className="app-nodrag flex h-[29px] shrink-0 items-center">
      <WinBtn label="最小化" onClick={() => void api.minimizeWindow()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <rect x="0" y="4.25" width="10" height="1.5" rx="0.5" fill="currentColor" />
        </svg>
      </WinBtn>
      <WinBtn label={maximized ? '还原' : '最大化'} onClick={() => void api.toggleMaximize().then(setMaximized)}>
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor">
            <rect x="0.75" y="2.75" width="6.5" height="6.5" rx="0.5" strokeWidth="1.2" />
            <path d="M2.75 2.75V0.75H9.25V7.25H7.25" strokeWidth="1.2" />
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden fill="none">
            <rect x="0.75" y="0.75" width="7.5" height="7.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </WinBtn>
      <WinBtn label="关闭" danger onClick={() => void api.closeWindow()}>
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden fill="none" stroke="currentColor">
          <path d="M0.75 0.75L8.25 8.25M8.25 0.75L0.75 8.25" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </WinBtn>
    </div>
  )
}

function WinBtn({
  label,
  onClick,
  danger = false,
  children
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-[22px] w-[46px] items-center justify-center text-[color:var(--tsm-win-icon)] transition-colors ${
        danger ? 'hover:bg-[color:var(--tsm-danger-hover)] hover:text-white' : 'hover:bg-hover'
      }`}
    >
      {children}
    </button>
  )
}
