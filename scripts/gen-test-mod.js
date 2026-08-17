// 生成用于测试的纯英文 Minecraft Mod jar 文件
// 运行：node scripts/gen-test-mod.js
const AdmZip = require('adm-zip')
const path = require('path')
const fs = require('fs')

const zip = new AdmZip()

// ---- fabric.mod.json ----
zip.addFile(
  'fabric.mod.json',
  Buffer.from(
    JSON.stringify(
      {
        schemaVersion: 1,
        id: 'testadventure',
        version: '1.0.0',
        name: 'Test Adventure Mod',
        description: 'A test mod for localization testing.',
        authors: ['Translator MC Test'],
        contact: { homepage: 'https://example.com' },
        license: 'MIT',
        icon: 'assets/testadventure/icon.png',
        environment: '*',
        entrypoints: { main: ['com.example.testadventure.TestAdventureMod'] },
        depends: { fabricloader: '>=0.15.0', minecraft: '~1.21' }
      },
      null,
      2
    )
  )
)

// ---- 现代格式语言文件 en_us.json ----
const enUsJson = {
  // 物品
  'item.testadventure.mystic_sword': 'Mystic Sword',
  'item.testadventure.mystic_sword.tooltip': 'A legendary blade forged in the depths of the Nether',
  'item.testadventure.shadow_bow': 'Shadow Bow',
  'item.testadventure.shadow_bow.tooltip': 'Fires arrows that pierce through the darkness\n§7Shift-right-click to inspect',
  'item.testadventure.arcane_pearl': 'Arcane Pearl',
  'item.testadventure.arcane_pearl.tooltip': '§bImbued with raw magical energy',
  'item.testadventure.crystal_shard': 'Crystal Shard',
  'item.testadventure.ancient_relic': 'Ancient Relic',
  'item.testadventure.ancient_relic.tooltip': 'A relic of a long-forgotten Overworld civilization',
  'item.testadventure.mystic_armor.chestplate': 'Mystic Chestplate',

  // 方块
  'block.testadventure.arcane_altar': 'Arcane Altar',
  'block.testadventure.mystic_ore': 'Mystic Ore',
  'block.testadventure.glowstone_lantern': 'Glowstone Lantern',
  'block.testadventure.runic_table': 'Runic Table',
  'block.testadventure.runic_table.tooltip': '§eUsed to craft magical items',
  'block.testadventure.shadow_brick': 'Shadow Brick',

  // 实体
  'entity.testadventure.shadow_wolf': 'Shadow Wolf',
  'entity.testadventure.arcane_golem': 'Arcane Golem',
  'entity.testadventure.crystal_guardian': 'Crystal Guardian',
  'entity.testadventure.ancient_spirit': 'Ancient Spirit',

  // 药水效果 / 附魔
  'effect.testadventure.arcane_power': 'Arcane Power',
  'effect.testadventure.shadow_veil': 'Shadow Veil',
  'enchantment.testadventure.soul_binding': 'Soul Binding',
  'enchantment.testadventure.mystic_edge': 'Mystic Edge',

  // GUI / 界面
  'gui.testadventure.arcane_altar.title': 'Arcane Altar',
  'gui.testadventure.craft': 'Craft',
  'gui.testadventure.cancel': 'Cancel',
  'gui.testadventure.confirm': 'Confirm',
  'gui.testadventure.mana': 'Mana',
  'gui.testadventure.mana.tooltip': 'Current magical energy: %s / %s',
  'gui.testadventure.recipe': 'Recipe',
  'gui.testadventure.ingredients': 'Ingredients',
  'gui.testadventure.result': 'Result',
  'gui.testadventure.insufficient_mana': 'Not enough mana! You need %d mana.',
  'gui.testadventure.level': 'Level',
  'gui.testadventure.experience': 'Experience',
  'screen.testadventure.settings': 'Settings',
  'screen.testadventure.settings.title': 'Test Adventure Settings',
  'screen.testadventure.settings.graphics': 'Graphics',
  'screen.testadventure.settings.quality': 'Quality',
  'screen.testadventure.settings.performance': 'Performance',
  'screen.testadventure.settings.render_distance': 'Render Distance',
  'screen.testadventure.settings.enable_shadows': 'Enable Shadows',
  'screen.testadventure.settings.shadow_quality': 'Shadow Quality',
  'screen.testadventure.settings.motion_blur': 'Motion Blur',
  'screen.testadventure.settings.anti_aliasing': 'Anti-Aliasing',
  'screen.testadventure.settings.reset': 'Reset to Defaults',

  // 命令
  'command.testadventure.give.success': 'Gave %1$s to %2$s',
  'command.testadventure.give.failure': 'Could not give item to %s',
  'command.testadventure.mana.query': 'Player %s has %d mana',
  'command.testadventure.mana.set': 'Set %s mana to %d',
  'command.testadventure.teleport.success': 'Teleported %s to %s, %s, %s',
  'command.testadventure.unknown': 'Unknown subcommand: %s',

  // 成就 / 进度
  'advancements.testadventure.root.title': 'Test Adventure',
  'advancements.testadventure.root.description': 'The journey begins',
  'advancements.testadventure.first_craft.title': 'First Enchantment',
  'advancements.testadventure.first_craft.description': 'Craft an item at the Arcane Altar',
  'advancements.testadventure.defeat_guardian.title': 'Guardian Slayer',
  'advancements.testadventure.defeat_guardian.description': 'Defeat the Crystal Guardian in the End',
  'advancements.testadventure.collect_relic.title': 'Relic Hunter',
  'advancements.testadventure.collect_relic.description': 'Collect all Ancient Relics',

  // 死亡消息
  'death.attack.testadventure.arcane': '%1$s was consumed by arcane energy',
  'death.attack.testadventure.shadow': '%1$s was slain by %2$s in the shadows',
  'death.attack.testadventure.fall': '%1$s fell from the Runic Table',

  // 生物群系
  'biome.testadventure.mystic_forest': 'Mystic Forest',
  'biome.testadventure.shadow_wastes': 'Shadow Wastes',
  'biome.testadventure.crystal_caverns': 'Crystal Caverns',

  // 状态提示 / 消息
  'message.testadventure.welcome': 'Welcome to Test Adventure!',
  'message.testadventure.mana_depleted': 'Your mana has been depleted!',
  'message.testadventure.relic_found': '§aAncient Relic found! §r(%d / %d)',
  'message.testadventure.portal_opened': 'A portal to the Nether has opened nearby',
  'message.testadventure.craft_success': 'Successfully crafted %s',
  'message.testadventure.not_enough_materials': 'You do not have enough materials',

  // 按键
  'key.testadventure.activate': 'Activate',
  'key.testadventure.spell_menu': 'Open Spell Menu',
  'key.categories.testadventure': 'Test Adventure',

  // 物品组
  'itemGroup.testadventure.blocks': 'Test Adventure Blocks',
  'itemGroup.testadventure.items': 'Test Adventure Items',
  'itemGroup.testadventure.tools': 'Test Adventure Tools'
}

// ---- 旧格式语言文件 en_US.lang（测试 .lang 解析）----
const enUsLang = [
  '# Test Adventure Mod - English (US)',
  'item.testadventure.legacy_sword=Legacy Sword',
  'item.testadventure.legacy_sword.tooltip=A blade from an older era',
  'block.testadventure.legacy_block=Legacy Block',
  'gui.testadventure.legacy_title=Legacy Interface',
  'message.testadventure.legacy_greeting=Welcome back, %s!',
  'death.attack.testadventure.legacy=%1$s died of old age'
].join('\n')

zip.addFile('assets/testadventure/lang/en_us.json', Buffer.from(JSON.stringify(enUsJson, null, 2)))
zip.addFile('assets/testadventure/lang/en_US.lang', Buffer.from(enUsLang))

// ---- 一个简单的图标占位（可忽略）----
zip.addFile('assets/testadventure/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))

// ---- 输出 ----
const outDir = path.join(__dirname, '..', 'test-files')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'test-adventure-mod.jar')
zip.writeZip(outPath)

console.log('已生成:', outPath)
console.log('条目数(JSON):', Object.keys(enUsJson).length)
console.log('条目数(.lang):', enUsLang.split('\n').filter((l) => l.includes('=')).length)
