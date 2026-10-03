import logo from '../../assets/logo.png'
import logo2 from '../../assets/logo2.jpg'
import { WindowControls } from './WindowControls'

/**
 * 顶栏 —— 对应设计稿 6:53 内的 6:54（logo pill + 版本号）与 36:121（三键）。
 * 高 66（设计稿顶栏实高），底边由主面板的 1px 描边界定。
 * 整条顶栏是窗口拖动区，内部控件全部 no-drag。
 */
export function TitleBar(): JSX.Element {
  return (
    <header className="app-drag flex h-[66px] shrink-0 items-center justify-between bg-bg">
      <div className="flex items-center gap-1">
        {/* logo pill：218×48，圆角 14，底 #d9d9d9，1px 线性渐变描边 */}
        <div
          className="flex h-12 shrink-0 items-center rounded-tile"
          style={{
            background: 'linear-gradient(90deg, #a4ff4a 0%, #0088ff 37%, #82d9ff 100%)',
            padding: 1
          }}
        >
          <div
            className="flex h-full items-center gap-[10px] rounded-[13px] px-[9px]"
            style={{ background: 'var(--tsm-logo-bg)' }}
          >
            <img
              src={logo2}
              alt=""
              draggable={false}
              className="h-[39px] w-[39px] shrink-0 rounded-[10px] object-cover"
            />
            <img src={logo} alt="Translator MC" draggable={false} className="h-8 w-[154px] object-contain" />
          </div>
        </div>
        <span className="font-machine text-xs text-ink">版本号：{__APP_VERSION__}</span>
      </div>

      <div className="pr-2.5">
        <WindowControls />
      </div>
    </header>
  )
}
