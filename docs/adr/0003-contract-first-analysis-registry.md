# 0003 合同先行与分析模块注册表

- 状态：已采纳
- 日期：2026-10-29

## 背景与问题

Loom 的价值随分析种类增长（以后会有安全审计、依赖升级建议等）。不同开发者用不同 AI 工具扩展时，
最容易出现的问题是：前后端数据结构漂移、新分析漏接某一端、工作流被改得越来越难读。

## 决定

1. **合同先行**：`packages/contracts` 是前后端唯一共享的代码。每种分析的产物、报告、运行状态都在这里用 Zod 定义，
   类型由 `z.infer` 推导。Agent 的结构化输出、报告写入、Web 端读取都用同一份 schema 校验。
2. **分析模块是唯一扩展点**：每个分析是一个 `AnalysisModule`（id、title、skill、phase、agent、step），
   在 `apps/loom/src/analyses/registry.ts` 注册。工作流的并行分析段与顾问段由注册表的 `phase` 生成，新增分析不改工作流。
3. **Web 分区注册表**：`apps/web/src/features/report/sections/registry.ts` 用
   `satisfies { [Id in AnalysisId]: ComponentType<SectionProps<Id>> }` 约束，漏写分区编译失败。
4. **一致性测试兜底**：`apps/loom/test/registry.test.ts` 检查每个 `analysisId` 都有模块、阶段一致、运行时技能存在且
   frontmatter 名称匹配、Web 分区文件存在，并且没有孤立的技能目录。
5. **假模式**：每个分析必须在 `@loom/contracts/fixtures` 提供夹具，`LOOM_AGENT_MODE=fake` 时直接返回，
   前端开发与工作流测试不依赖模型。

## 理由

- 类型系统 + 一个测试就能在 `npm run check` 阶段指出“缺了哪个文件”，不依赖评审者记得接入清单。
- 报告带 `schemaVersion`，Web 端对旧报告给出明确的合同不符提示，而不是渲染出错。
- 夹具同时服务假模式、工作流测试、前端组件测试，一处维护。

## 代价

- 新增分析要改 8 个左右的文件；用技能 `loom-add-analysis` 给出逐步清单来降低成本。
- contracts 不能放运行时逻辑，偶尔需要的小函数（如 `stepGroupOf`）必须保持纯、无依赖。
