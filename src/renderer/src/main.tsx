import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { UpdateDemo } from './components/update/UpdateDemo'
import { UpdateProgressWindow } from './components/update/UpdateProgressWindow'
import './assets/fonts/fonts.css'
import './index.css'

/**
 * 同一个渲染入口承担两个窗口：
 *  - 主窗口：完整 App
 *  - 更新进度窗口：主进程用 `loadFile(index.html, { search: 'window=update&source=…' })` 打开，
 *    这里按查询参数只挂载进度视图（不必再维护一套构建入口）。
 */
const params = new URLSearchParams(window.location.search)
const isUpdateWindow = params.get('window') === 'update'
// 更新界面测试脚手架（逐帧比对设计稿用；正常运行不可达）：
// 设 `localStorage['tsm-demo'] = 'update'` 后刷新进入，清除即恢复。
const isDemo = params.get('demo') === 'update' || window.localStorage.getItem('tsm-demo') === 'update'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isUpdateWindow ? <UpdateProgressWindow /> : isDemo ? <UpdateDemo /> : <App />}
  </React.StrictMode>
)
