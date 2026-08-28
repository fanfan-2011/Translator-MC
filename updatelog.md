# Translator MC 更新日志

## v1.7.1 — 2026-08-28

**翻译解析修复**

- `json-repair.ts` 重写 LLM 响应解析：新增 `collectLeavesFromNode` + `resolveValue`，支持从嵌套结构恢复被 LLM 错误拆分的点号 key（如 `"value.info0.0"` 被嵌套为 `{"value":{"info0":{"0":"..."}}}`）
- `service.ts` 传入 `requestedKeys` 过滤，只接受请求列表中的 key，过滤掉中间层级的虚假路径
- 修复 `AI 未返回 key "value.info0.0" 的译文` 错误

---

## v1.6.0 — 2026-08-25

**任务控制与设置界面改进**

- 修复翻译/审校任务的取消按钮失效问题：`TaskController` 新增 `onCancel` 回调，传递 `AbortSignal` 给 LLM 请求层，取消时立即中止未完成的网络请求
- 修复暂停/继续按钮不生效问题：状态变化时立即推送进度，界面实时响应
- 设置界面「模型」字段改为下拉选择 + 手动输入双模式，刷新后显示可用模型列表
- 新增超时处理：60 秒超时后自动抛出错误，不再无限等待

---

## v1.5.1 — 2026-08-25

**文件夹导入递归扫描 mod jar**

- 导入文件夹时自动递归扫描 `.jar` 文件内部的语言文件（`assets/*/lang/` 路径）
- 导出时自动剥离 jar 包路径前缀，资源包路径从 `mods/x.jar!assets/xenon/lang/en_us.lang` 还原为 `assets/xenon/lang/en_us.lang`
- 避免字节码/贴图被错误提取

---

## v1.5.0 — 2026-08-25

**跳过空占位符条目**

- 过滤空源文本条目（如 shader 语言文件中的 `value.info0.0=`），避免对空白内容发起无意义的 LLM 请求
- 修复因此导致的「AI 未返回译文」误报

---

## v1.4.0 — 2026-08-25

**修复点号 key 嵌套问题**

- `json-repair.ts` 新增 `flattenTranslations`，处理 LLM 将字面量点号 key（如 `"value.info0.0"`）错误嵌套为多级对象的情况
- `prompts.ts` 系统提示词增加明确警告：key 是完整字符串，不能按 `.` 拆分成多级嵌套对象

---

## v1.3.0 — 2026-08-21

**导出命名格式变更**

- 导出的汉化资源包命名改为 `<原模组名称>transistor.zip`（如 `sodium-test-modtransistor.zip`）
- 非法字符（`\ / : * ? " < > |`）自动替换为 `_`

---

## v1.2.0 — 2026-08-18

**数据库持久化修复**

- 修复数据库损坏问题：保存逻辑改为串行队列 + 原子写（先写 `.tmp` 再 `rename`），杜绝定时器与 `persistNow` 并发写同一文件导致半写损坏
- 数据库 integrity 检查通过，所有表结构完整保留

---

## v1.1.0 — 2026-08-17

**初始正式版**

- 拖放导入修复：使用 Electron 官方 `webUtils.getPathForFile()` 替代已废弃的 `File.path`
- 拖放区域扩大到整个首页（原为虚线框）
- 新增 logo.png（左上角长条）和 logo2.jpg（方形图标）
- 自定义 `.tmhelp` 帮助格式（TMHP 魔数 + XOR 0x5A），应用内 modal 打开
- API Key 使用 Electron `safeStorage`（Windows DPAPI）加密存储
- 远程 README/LICENSE 保留用户自有版本，不覆盖
- `package.json` name 保持 `game-localizer`，数据库保持 `gamelocalizer.db`
- 打包前自动清理残留 `Translator MC.exe` 进程
- `build:win` 自动执行 `scripts/build-help.js`
- 版本归档至 `versions/<大版本>/<小版本>/`，`release/` 只留最新版本

---

## v1.0.0-alpha — 2026-08-17

**Alpha 测试版**

- 首次发布，包含基础导入、翻译、导出功能
