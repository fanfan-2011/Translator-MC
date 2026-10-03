import { useEffect, useState } from 'react'
import { api, type UpdateInfo } from '../../api'

/**
 * 检查更新卡 —— 设计稿 36:101：292×76，白底，圆角 20，1px #e5e7eb 描边，
 * 阴影 update，H gap12 pad12/14。标题 Anonymous Pro Bold 15，
 * 版本/提交行 Anonymous Pro Regular 12 #6b7280，
 * CTA 112×40 #66da48 圆角 12（Anonymous Pro Bold 13 白字）。
 * 没有任何更新（或查不到）时整卡不渲染。
 */
export function UpdateCard(): JSX.Element | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    let alive = true
    void api.checkUpdate().then((r) => {
      if (alive) setInfo(r)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!info?.available) return null

  return (
    <div className="flex w-full items-center gap-3 rounded-update border border-line bg-surface px-3.5 py-3 shadow-update">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate-1 font-machine text-md font-bold text-ink">发现新版本！</div>
        <div className="flex flex-col gap-0.5">
          <span className="truncate-1 font-machine text-xs text-muted">版本号：{info.latest}</span>
          <span className="truncate-1 font-machine text-xs text-muted">
            {info.commit ? `${info.commit} 最近一次提交` : `当前版本：${info.current}`}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (info.url) window.open(info.url)
        }}
        className="flex h-10 w-28 shrink-0 items-center justify-center rounded-sm bg-primary font-machine text-sm font-bold text-primary-fg shadow-[0_6px_14px_-4px_rgba(102,218,72,0.2)] transition-[filter] hover:brightness-95"
      >
        点击查看详情
      </button>
    </div>
  )
}
