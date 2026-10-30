# packages/contracts（@loom/contracts）

前后端唯一共享的代码：Zod schema、由 schema 推导的类型、假模式与测试用的夹具。先读根目录 `AGENTS.md`。

## 规则

- 只依赖 `zod`，不能引用任何 app，不写运行时逻辑（纯 schema、常量和极小的纯函数，例如 `stepGroupOf`）。
- 直接导出 TypeScript 源码（`exports` 指向 `src/*.ts`），没有构建步骤；Web 端经 `transpilePackages` 编译。
- 类型一律 `z.infer<typeof schema>`，不手写重复的 interface。
- 给 Agent 输出的 schema 字段写 `.describe(...)`，它会进入结构化输出的提示。
- 可选字段用 `.nullable()` 表达“模型确认没有”，用 `.optional()` 表达“输入可省略”，不要混用。

## 结构

```text
src/analyses/<id>.ts      各分析产物 schema
src/analyses/index.ts     analysisIds、analysisDefinitions（id → phase + schema）、artifactsSchema
src/repo.ts               仓库引用与 scout 结果
src/report.ts             报告、步骤错误、引用核实；REPORT_SCHEMA_VERSION
src/run.ts                工作流输入输出、运行摘要、步骤 id、loomRoutes
src/fixtures/             夹具（@loom/contracts/fixtures）
```

## 修改合同

- 破坏性变更（删字段、改类型、收紧校验）要提升 `REPORT_SCHEMA_VERSION`，Web 端遇到旧报告会显示合同不符。
- 改完同步更新 `src/fixtures/`，否则 `contracts.test.ts` 与假模式会失败。
- 完整流程见技能 `loom-change-contract`。
- 新增或改名导出后，正在运行的 `mastra dev` 可能仍用旧的打包缓存（报 `does not provide an export named ...`）：
  停掉服务，删除 `packages/contracts/node_modules/.cache/` 后重启。
