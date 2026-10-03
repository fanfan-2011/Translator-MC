import { useState, type DragEvent } from 'react'
import { FileUp, FolderOpen, Package, Plus, Upload } from 'lucide-react'
import { api } from '../../api'
import { useApp } from '../../stores/app'
import { PACKAGE_LABEL, displayVersion, formatTime } from '../../lib/status'
import { Button, Card, Chip, EmptyState, Field, Input, Modal } from '../ui'

/**
 * 项目页 —— 设计稿只画了「翻译」页，这一页按 UI-SPEC 第 6 节推导：
 * 操作栏（标题 + 导入入口）+ 项目卡片网格 + 拖拽导入。
 */
export function Home(): JSX.Element {
  const projects = useApp((s) => s.projects)
  const packages = useApp((s) => s.packages)
  const openProject = useApp((s) => s.openProject)
  const openImport = useApp((s) => s.openImport)
  const createProject = useApp((s) => s.createProject)
  const toastMsg = useApp((s) => s.toastMsg)
  const [dragging, setDragging] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const pickFiles = async (): Promise<void> => {
    const p = (await api.selectFiles()) as string[]
    if (p.length > 0) openImport(p)
    else toastMsg('未选择任何文件', 'info')
  }

  const pickDir = async (): Promise<void> => {
    const p = (await api.selectDir()) as string[]
    if (p.length > 0) openImport(p)
  }

  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
      .map((f) => api.getPathForFile(f))
      .filter((p): p is string => !!p)
    if (dropped.length > 0) openImport(dropped)
  }

  const submitNew = async (): Promise<void> => {
    setCreating(true)
    try {
      const id = await createProject(name)
      setNewOpen(false)
      setName('')
      await openProject(id)
      toastMsg('项目已创建', 'success')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex h-[71px] shrink-0 items-center gap-4 rounded-tl-panel border-b border-line bg-surface-2 px-4">
        <span className="text-lg font-semibold text-ink">项目</span>
        <Chip>{`共 ${projects.length} 个`}</Chip>
        <div className="h-7 w-px shrink-0 rounded-full bg-line" />
        <Button variant="primary" onClick={() => void pickFiles()}>
          <FileUp className="h-4 w-4" strokeWidth={2} />
          导入 Mod / 资源包
        </Button>
        <Button onClick={() => void pickDir()}>
          <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
          选择目录
        </Button>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          新建项目
        </Button>
        <div className="min-w-0 flex-1" />
        <span className="shrink-0 text-sm text-muted-3">支持 .jar / .zip / 目录</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {dragging ? (
          <div className="mb-3 flex h-24 items-center justify-center rounded-card border border-dashed border-accent bg-accent-soft text-sm font-semibold text-accent">
            松开鼠标即可导入
          </div>
        ) : null}

        {projects.length === 0 ? (
          <div className="flex h-full min-h-[420px] rounded-card border border-dashed border-line-2">
            <EmptyState
              icon={<Upload className="h-6 w-6" strokeWidth={1.7} />}
              title="还没有项目"
              description="把 Mod、资源包或光影包拖进窗口，Agent 会自动分析文件结构并提取可翻译文本。"
              action={
                <>
                  <Button variant="primary" onClick={() => void pickFiles()}>
                    选择文件
                  </Button>
                  <Button onClick={() => setNewOpen(true)}>新建空项目</Button>
                </>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 content-start gap-3 pb-1 xl:grid-cols-3">
            {projects.map((p) => {
              const pkg = packages.find((x) => x.projectId === p.id)
              return (
                <Card key={p.id} className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-update">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile border border-[#d7e8ff] bg-accent-soft">
                      <Package className="h-[18px] w-[18px] text-accent-2" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate-1 text-md font-semibold text-ink">{p.name}</div>
                      <div className="truncate-1 text-xs text-muted-4">
                        更新于 {formatTime(p.updatedAt)}
                      </div>
                    </div>
                  </div>
                  {pkg ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Chip className="shrink-0">{PACKAGE_LABEL[pkg.type]}</Chip>
                      {displayVersion(pkg.version) ? (
                        <Chip className="min-w-0">{`版本: ${displayVersion(pkg.version)}`}</Chip>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-end">
                    <Button variant="primary" size="sm" onClick={() => void openProject(p.id)}>
                      打开
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="新建项目"
        width="max-w-md"
        footer={
          <>
            <Button onClick={() => setNewOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void submitNew()} disabled={creating}>
              创建
            </Button>
          </>
        }
      >
        <Field label="项目名称" hint="留空则自动命名；项目用于归集同一个 Mod / 资源包的翻译条目。">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：机械动力"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNew()
            }}
          />
        </Field>
      </Modal>
    </div>
  )
}
