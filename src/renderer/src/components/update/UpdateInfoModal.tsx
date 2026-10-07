import { X } from 'lucide-react'
import type { CheckResult } from '../../api'

/**
 * 「检查到更新！」详情弹窗 —— Figma 58:84（482×678）
 *   · 外框：r28，底 #f9f3df，描边 1px #e8dccb，纵向 gap16，内边距 24
 *   · header 76 = 标题行 34（标题 28 Bold + 关闭 32×32 r8）+ 版本胶囊 251×32（r999 白底，13px：版本 / • / 提交号 #66da48 / 最近一次提交）
 *   · content-card 434×478：r20 底 #fffcf4 描边 1px #e8dccb，内边距 20 / gap14
 *       标题「更新内容：」18 Bold；滚动区 394×402（自定义 4px 滚动条 + 滚轮），正文 13/22
 *   · actions 434×44 / gap12：取消 211×44 r14（白底 + 描边 #d8c9a8 16 SemiBold）／立即更新！211×44 r14（#66da48 + 白字 16 Bold）
 *
 * 配色为**固定奶油色**（用户裁决），不随亮/暗主题变化。
 */
export function UpdateInfoModal({
  info,
  onCancel,
  onProceed
}: {
  info: CheckResult
  onCancel: () => void
  onProceed: () => void
}): JSX.Element | null {
  const best = info.best
  if (!best) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.45)] p-6">
      <div className="flex max-h-[calc(100vh-3rem)] w-[482px] flex-col gap-4 overflow-hidden rounded-upd border border-upd-line bg-upd-bg p-6 shadow-menu">
        {/* header */}
        <div className="flex flex-col gap-2.5">
          <div className="flex h-[34px] items-center justify-between">
            <h2 className="text-upd-h1 font-bold text-upd-ink">检查到更新！</h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-win text-upd-ink transition-colors hover:bg-[rgba(31,31,31,0.07)]"
            >
              <X size={17} strokeWidth={2.2} />
            </button>
          </div>

          <div className="flex h-8 w-fit min-w-[251px] items-center gap-2 whitespace-nowrap rounded-full border border-upd-line bg-upd-white px-3 text-[13px] leading-none">
            <span className="font-semibold text-upd-ink">版本 {best.version}</span>
            <span className="text-upd-muted">•</span>
            <span className="font-semibold text-upd-accent">{best.commit ?? '未知'}</span>
            <span className="text-upd-muted">最近一次提交</span>
          </div>
        </div>

        {/* content-card */}
        <div className="flex basis-[478px] shrink flex-col gap-3.5 overflow-hidden rounded-update border border-upd-line bg-upd-card p-5">
          <div className="text-upd-lg2 font-bold text-upd-ink">更新内容：</div>
          <div className="tsm-upd-scroll min-h-0 flex-1 overflow-y-auto pr-1.5">
            <div className="selectable whitespace-pre-wrap break-words text-sm leading-[22px] text-upd-ink">
              {best.changelog || '（本次更新没有填写说明）'}
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-tile border border-upd-line-2 bg-upd-white text-lg font-semibold text-upd-ink transition-[filter] hover:brightness-[0.98]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="h-11 flex-1 rounded-tile border border-upd-accent bg-upd-accent text-lg font-bold text-upd-white transition-[filter] hover:brightness-95"
          >
            立即更新！
          </button>
        </div>
      </div>
    </div>
  )
}
