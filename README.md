# Translator MC

Minecraft AI 翻译工具 —— 把 Minecraft Mod / Resource Pack / Shader Pack 拖进来，Agent 自动分析文件结构、提取文本、调用大模型批量翻译、术语管理、质量检查、人工审核，最后安全导出（不覆盖原文件）。

## 运行方法

### 方式一：直接运行打包好的程序（推荐）

1. 在“发行版”下载最新版本二进制文件，

| 文件名                                | 文件类型   |
|------------------------------------|--------|
| Translator-MC-mobile-win-1.1.0.zip | 免安装版   |
| Translator-MC-Setup-win-1.1.0.exe  | exe安装包 |


### 方式二：开发模式运行（需要 Node.js 20+）

```bash
npm install        # 首次安装依赖
npm run dev        # 启动开发模式（热更新）
```

### 方式三：自己重新打包

```bash
npm run build:win  # 构建 + 打包 Windows 安装程序（输出到 release/）
```

## 使用流程

1. **导入**：把 `.jar` / `.zip` / 目录拖进主界面（或点「选择文件 / 选择目录」）
2. **自动识别**：Agent 自动识别 Mod / 光影包 / 资源包，找到语言文件（en_us.json、en_US.lang 等），提取文本，并检测已有中文（标记为「自带中文」，默认不覆盖）
3. **配置 AI**：侧边栏「AI 设置」填入 Provider、API Endpoint、API Key、模型（支持 OpenAI 兼容接口，内置 OpenAI / DeepSeek / 智谱 / Moonshot / Ollama / LM Studio 预设）
4. **翻译**：在工作台点「AI 翻译」（翻译选中的条目），支持批量、并发、限速、失败重试、暂停/继续/取消
5. **审校**：点「AI 审校」用第二个 Agent 检查译文质量（评分 < 70 自动标记「需审核」）
6. **人工修改**：双击译文单元格直接编辑（自动保存，状态变为「人工确认」）
7. **导出**：侧边栏「导出」→ 导出汉化资源包（zip）或修改后的 Jar（`xxx-localized.jar`），绝不覆盖原文件

## 核心功能（37 项全部实现）

| 能力 | 说明 |
|---|---|
| 拖拽导入 | 支持 .jar / .zip / 目录，可多文件 |
| 类型识别 | Mod（fabric.mod.json / quilt / mods.toml / mcmod.info）、资源包（pack.mcmeta）、光影包（shaders/） |
| 语言文件解析 | JSON / JSON5 / .lang / .properties / YAML / TOML 多解析器适配 |
| 已有中文检测 | 扫描 zh_cn / zh-CN / zh_tw / zh-TW，标记 builtin 不覆盖 |
| 源语言适配 | 自动识别日语/韩语/德语/法语/俄语等非英语源语言 |
| 目标语言选择 | 简中/繁中/日/韩/英/法/德/俄/西/葡/意 12 种目标语言 |
| AI 批量翻译 | 多条一批，支持 OpenAI 兼容 API |
| 多 Provider | OpenAI / DeepSeek / 智谱 / Moonshot / Ollama / LM Studio / 自定义 Endpoint |
| 并发/限速/重试 | Semaphore 并发 + 请求间隔限速 + 指数退避重试（1s/2s/4s/8s） |
| 暂停/继续/取消 | 真正停止后续请求 |
| 术语表 | 增删改查，注入 Prompt，术语一致性校验 |
| 专用 Prompt | Mod / Shader / Resource Pack 三套独立系统提示词 |
| 上下文翻译 | 注入包名、分类、术语表、翻译记忆 |
| 翻译记忆 (TM) | 完全相同的原文自动复用 |
| 翻译历史 | 每次 AI/人工修改记录版本 |
| 占位符校验 | %s / %1$s / %d / ${name} / <player> 等 |
| 格式代码保护 | §a / §b / §r 等 |
| JSON Schema 校验 | LLM 输出 JSON 修复解析 |
| AI 质量审校 | 评分、问题、建议 |
| 问题中心 | 汇总占位符/术语/格式/缺失等问题 |
| 导出 | 资源包 zip + 修改后的 Jar，永不覆盖原文件 |
| 数据 | SQLite（sql.js）持久化，自动保存 |
| 其它 | 搜索/筛选/批量选择/虚拟滚动表格/主题切换/快捷键/日志 |


## 测试

```bash
npm run typecheck                 # TypeScript 类型检查
node scripts/selftest.cjs         # 核心逻辑自测（需先 npx esbuild 打包）
npx electron . --selftest         # 全流程端到端自测（导入→识别→提取→入库→导出）
```

## 说明

- 导出永远生成新文件（`-localized` 后缀或独立 zip），不会覆盖原始 Mod/资源包
