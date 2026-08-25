import { targetLanguageName, type GlossaryEntry, type PackageType, type TranslationEntry } from '@shared/types'

const COMMON_RULES = `【翻译规则】必须严格遵守：
1. 优先使用 Minecraft 官方译名，其次使用社区通用译名。
2. 根据内容包上下文翻译，同一个内容包内术语必须保持一致。
3. 不翻译 key；不翻译 mod id；不翻译 URL；不翻译文件路径；不翻译命令。
4. 绝不修改占位符（如 %s、%1$s、%d、%f、%%、\\n、\\t、\${name}、{name}、<player>）。
5. 绝不修改格式代码（如 §a、§b、§c、§r）。
6. 不添加原文不存在的信息，不删除原文信息，保持原文语气。
7. UI 文本要简洁自然，Tooltip 要符合游戏 UI 表达。
8. 必须结合上下文判断词义，避免机械直译。`

function modSystem(langName: string): string {
  return `你是一名资深 Minecraft Java Edition Mod 本地化专家。
任务：将给定的游戏文本翻译为${langName}。
${COMMON_RULES}`
}

function shaderSystem(langName: string): string {
  return `你是一名资深 Minecraft Shader / 图形设置本地化专家。
任务：将给定的光影包/图形设置文本翻译为${langName}。
【重点】涉及 Bloom、SSAO、FXAA、TAA、Motion Blur、Depth of Field、Volumetric Fog、Volumetric Clouds、Tone Mapping、Exposure、Gamma、Shadow、Reflection、Refraction、Specular、Ambient、Upscaling、Render Distance、Quality、Performance、Visuals、Utilities 等术语时，优先采用图形学行业通用译名，不要机械直译；设置名称要简洁，Tooltip 可适当完整。
${COMMON_RULES}`
}

function resourcepackSystem(langName: string): string {
  return `你是一名资深 Minecraft 资源包本地化专家。
任务：将给定的资源包文本（物品名称、方块名称、实体名称、GUI、菜单、按钮、Tooltip、进度、物品 Lore）翻译为${langName}。
【重点】物品/方块/实体名称必须优先使用 Minecraft 官方译名。
${COMMON_RULES}`
}

export function buildSystemPrompt(packageType: PackageType, targetLanguage = 'zh_cn'): string {
  const langName = targetLanguageName(targetLanguage)
  switch (packageType) {
    case 'mod':
      return modSystem(langName)
    case 'shader':
      return shaderSystem(langName)
    case 'resourcepack':
      return resourcepackSystem(langName)
    default:
      return modSystem(langName)
  }
}

export function buildGlossaryBlock(glossary: GlossaryEntry[]): string {
  if (glossary.length === 0) return ''
  const lines = glossary.map((g) => `${g.source} → ${g.target}`).join('\n')
  return `\n【术语表】以下术语必须严格按对应关系翻译：\n${lines}\n`
}

export function buildUserMessage(
  entries: TranslationEntry[],
  context: { packageName?: string; category?: string; packageType?: PackageType; targetLanguage?: string }
): string {
  const langName = targetLanguageName(context.targetLanguage ?? 'zh_cn')
  const header = [
    context.packageName ? `内容包：${context.packageName}` : '',
    context.category ? `分类：${context.category}` : '',
    context.packageType ? `类型：${context.packageType}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  const items = entries.map((e) => `"${e.key}" = ${JSON.stringify(e.sourceText)}`).join('\n')

  return `${header}

【待翻译条目】请将以下 key 对应的原文翻译为${langName}：
${items}

【输出格式】只输出一个 JSON 对象，格式严格如下，不要输出 Markdown、代码块标记、解释或任何额外文本：
{"translations":{"key1":"译文1","key2":"译文2"}}

每个待翻译的 key 都必须原样出现在 translations 中。注意：key 是完整字符串（例如 "value.info0.0"），必须作为整体出现，绝不能按 "." 拆分成多级嵌套对象。译文为对应原文的${langName}翻译。`
}

export function buildReviewPrompt(
  entries: { key: string; sourceText: string; targetText: string }[],
  packageType: PackageType,
  targetLanguage = 'zh_cn'
): string {
  const system = buildSystemPrompt(packageType, targetLanguage)
  const items = entries
    .map((e) => `key: "${e.key}"\n原文: ${JSON.stringify(e.sourceText)}\n译文: ${JSON.stringify(e.targetText)}`)
    .join('\n\n')
  return `${system}

【任务】对以下翻译结果进行质量审校，检查语义准确性、术语一致性、占位符/格式代码是否保留、是否遗漏或添加信息。
${items}

【输出格式】只输出 JSON，格式：
{"results":[{"key":"...","score":92,"issues":[],"suggestion":null}]}
score 为 0-100 的整数，issues 为字符串数组（发现问题时填写），suggestion 为改进建议或 null。`
}
