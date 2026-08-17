import { useState, type DragEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { Button } from '../ui'
import { ImportModal } from './ImportModal'

export function Home(): JSX.Element {
  const [paths, setPaths] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const toastMsg = useApp((s) => s.toastMsg)

  const beginImport = async (incoming: string[]): Promise<void> => {
    if (incoming.length === 0) return
    setPaths(incoming)
  }

  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const dropped = files
      .map((f) => api.getPathForFile(f))
      .filter((p): p is string => !!p)
    void beginImport(dropped)
  }

  const pickFiles = async (): Promise<void> => {
    const p = await api.selectFiles()
    if (p.length > 0) void beginImport(p)
    else toastMsg('未选择任何文件', 'info')
  }

  const pickDir = async (): Promise<void> => {
    const p = await api.selectDir()
    if (p.length > 0) void beginImport(p)
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-center p-8"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div
        className={`flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 transition-colors ${
          dragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800/50'
        }`}
      >
        <Sparkles className="h-12 w-12 text-primary-500" />
        <h2 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">准备好翻译了吗？</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          将 Mod、资源包或光影包拖入这里，Agent 会自动分析文件结构
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" size="lg" onClick={() => void pickFiles()}>
            选择文件
          </Button>
          <Button size="lg" onClick={() => void pickDir()}>
            选择目录
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
        <span>支持：</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">Minecraft Mod</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">Resource Pack</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">Shader Pack</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">本地化文件 (.jar / .zip / 目录)</span>
      </div>

      {paths ? <ImportModal paths={paths} onClose={() => setPaths(null)} /> : null}
    </div>
  )
}
