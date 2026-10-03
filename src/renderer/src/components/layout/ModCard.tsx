import { useEffect, useRef, useState } from 'react'
import { Package, ChevronDown, FolderPlus, Upload, Check } from 'lucide-react'
import { useApp } from '../../stores/app'
import { PACKAGE_LABEL, displayVersion } from '../../lib/status'
import { Chip } from '../ui'

/**
 * mod 信息卡 —— 设计稿 21:4：319×76，白底，1px #e5e7eb 描边，圆角 16，
 * 阴影 card，H gap12 pad12。左侧 52×52 图标块（#eaf4ff + #d7e8ff 描边，圆角 14），
 * 中间名称（Inter Semi Bold 16）+ 元信息 chips，右侧 28×28 展开指示。
 * 设计稿里的「大小: 4.6 MB」在本项目数据层没有对应字段（PackageInfo 只有
 * type/version/modId），因此 chips 展示真实的「类型 / 版本」，不编造体积。
 */
export function ModCard(): JSX.Element {
  const projects = useApp((s) => s.projects)
  const currentProjectId = useApp((s) => s.currentProjectId)
  const packages = useApp((s) => s.packages)
  const openProject = useApp((s) => s.openProject)
  const setImportOpen = useApp((s) => s.setImportOpen)
  const toastMsg = useApp((s) => s.toastMsg)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = projects.find((p) => p.id === currentProjectId)
  const pkg = packages.find((p) => p.projectId === currentProjectId)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div className="flex h-[76px] w-full items-center gap-3 overflow-hidden rounded-card border border-line bg-surface px-3 shadow-card">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-tile border border-[#d7e8ff] bg-[color:var(--tsm-accent-soft)]">
          <Package className="h-[22px] w-[22px] text-accent-2" strokeWidth={1.7} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="truncate-1 text-lg font-semibold leading-5 text-ink">
            {current?.name ?? pkg?.name ?? '未选择项目'}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {pkg ? (
              <Chip className="shrink-0">{`类型: ${PACKAGE_LABEL[pkg.type]}`}</Chip>
            ) : null}
            {displayVersion(pkg?.version) ? (
              <Chip className="min-w-0">{`版本: ${displayVersion(pkg?.version)}`}</Chip>
            ) : null}
            {!pkg ? <Chip className="min-w-0">{`项目 ${projects.length} 个`}</Chip> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-tile border border-line bg-surface-2 text-muted transition-colors hover:bg-hover"
          title="切换项目"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[80px] z-40 rounded-sm border border-line bg-surface py-1 shadow-menu">
          {projects.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">还没有项目，先导入一个 Mod</div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  void openProject(p.id)
                }}
                className={`flex h-8 w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-hover ${
                  p.id === currentProjectId ? 'bg-selected font-medium text-ink-2' : 'text-ink-3'
                }`}
              >
                {p.id === currentProjectId ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span className="truncate-1">{p.name}</span>
              </button>
            ))
          )}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void (async () => {
                const paths = await window.api.selectFiles()
                const list = (paths ?? []) as string[]
                if (list.length === 0) {
                  toastMsg('未选择任何文件', 'info')
                  return
                }
                useApp.setState({ importPaths: list })
                setImportOpen(true)
              })()
            }}
            className="flex h-8 w-full items-center gap-2 px-3 text-left text-sm text-ink-3 transition-colors hover:bg-hover"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            导入文件…
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void useApp
                .getState()
                .createProject()
                .then((id) => openProject(id))
            }}
            className="flex h-8 w-full items-center gap-2 px-3 text-left text-sm text-ink-3 transition-colors hover:bg-hover"
          >
            <FolderPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            新建项目
          </button>
        </div>
      ) : null}
    </div>
  )
}
