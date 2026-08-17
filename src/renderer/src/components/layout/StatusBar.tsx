import { useApp } from '../../stores/app'
import { APP_NAME } from '@shared/types'

export function StatusBar(): JSX.Element {
  const task = useApp((s) => s.task)
  const reviewing = useApp((s) => s.reviewing)
  const llmConfig = useApp((s) => s.llmConfig)

  const apiStatus = llmConfig.endpoint ? (llmConfig.model ? `已配置 (${llmConfig.model})` : '已配置') : '未配置 AI 服务'

  let agentText = '空闲'
  if (reviewing) {
    agentText = `AI 审校中 ${reviewing.done}/${reviewing.total}`
  } else if (task) {
    const statusText =
      task.status === 'paused' ? '已暂停' : task.status === 'running' ? '翻译中' : task.status
    agentText = `${statusText} ${task.done}/${task.total}`
  }

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-4 text-[11px] text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${task || reviewing ? 'animate-pulse bg-primary-500' : 'bg-slate-300'}`} />
        Agent: {agentText}
      </span>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <span>API: {apiStatus}</span>
      <span className="ml-auto">{APP_NAME} v{__APP_VERSION__}</span>
    </footer>
  )
}
