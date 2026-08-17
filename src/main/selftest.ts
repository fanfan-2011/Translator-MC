import AdmZip from 'adm-zip'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importFiles } from './package/importer'
import * as db from './db/database'
import { exportPreCheck, exportProject } from './export/exporter'
import { logger } from './logger'

// Full end-to-end self-test running inside the real Electron main process:
// import a synthetic mod → detect → extract → persist → edit → export → verify.
export async function runSelfTest(): Promise<boolean> {
  logger.info('=== 运行全流程端到端自测 ===')
  let projectId = ''
  try {
    const dir = await fs.mkdtemp(join(tmpdir(), 'gl-e2e-'))

    // 1) build a synthetic mod jar
    const jar = new AdmZip()
    jar.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ id: 'testmod', name: 'Test Mod', version: '1.0.0' })))
    jar.addFile(
      'assets/testmod/lang/en_us.json',
      Buffer.from(JSON.stringify({ 'item.diamond': 'Diamond', 'item.iron': 'Iron Ingot', 'gui.done': 'Done' }))
    )
    jar.addFile('assets/testmod/lang/zh_cn.json', Buffer.from(JSON.stringify({ 'item.diamond': '钻石' })))
    const jarPath = join(dir, 'testmod.jar')
    jar.writeZip(jarPath)

    // 2) import (detect + extract + persist)
    const result = await importFiles([jarPath])
    projectId = result.projectId
    logger.info(`导入: ${result.stats.entryCount} 条，自带中文 ${result.stats.builtinCount} 条，类型 ${result.packages[0].type}`)
    if (result.stats.entryCount !== 3) throw new Error(`导入条目数错误: ${result.stats.entryCount}`)
    if (result.stats.builtinCount !== 1) throw new Error(`builtin 数错误: ${result.stats.builtinCount}`)

    const entries = db.listEntries(projectId)
    if (entries.length !== 3) throw new Error(`DB 条目数错误: ${entries.length}`)

    // 3) manual edit (simulate human review)
    const pending = entries.find((e) => e.key === 'gui.done')
    if (!pending) throw new Error('未找到待翻译条目')
    db.updateEntryTarget(pending.id, '完成', 'human_reviewed')
    db.addHistory(pending.id, 'human', '完成')

    // 4) export resource pack
    const outZip = join(dir, 'out.zip')
    const exp = await exportProject(projectId, { kind: 'resourcepack', skipBuiltin: false, targetLang: 'zh_cn' }, outZip)
    if (!exp.ok) throw new Error(`资源包导出失败: ${exp.error}`)
    const out = new AdmZip(outZip)
    const names = out.getEntries().map((e) => e.entryName)
    if (!names.includes('assets/testmod/lang/zh_cn.json')) throw new Error('导出缺少 zh_cn.json')
    const content = out.readAsText('assets/testmod/lang/zh_cn.json')
    if (!content.includes('钻石') || !content.includes('完成')) throw new Error('导出内容缺失')
    logger.info(`资源包导出验证通过 (${names.join(', ')})`)

    // 5) export patched jar
    const jarExp = await exportProject(projectId, { kind: 'jar', skipBuiltin: false, targetLang: 'zh_cn' })
    if (!jarExp.ok) throw new Error(`jar 导出失败: ${jarExp.error}`)
    logger.info(`Jar 导出验证通过: ${jarExp.outputPath}`)

    // 6) export pre-check
    const pre = exportPreCheck(projectId)
    logger.info(`导出前检查: ${pre.count} 个问题`)

    // 7) cleanup
    db.deleteProject(projectId)
    projectId = ''

    logger.info('=== 端到端自测全部通过 ===')
    return true
  } catch (e) {
    logger.error(`端到端自测失败: ${e instanceof Error ? e.message : String(e)}`)
    if (projectId) db.deleteProject(projectId)
    return false
  }
}
