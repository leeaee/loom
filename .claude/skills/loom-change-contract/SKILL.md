---
name: loom-change-contract
description: 修改 packages/contracts 中的 Zod 合同（分析产物、报告、运行状态、路由、工作流输入输出）时的规则与步骤，包括向后兼容判断、REPORT_SCHEMA_VERSION、夹具更新以及 apps/loom 与 apps/web 的同步。任何跨前后端的数据结构变化都使用此技能。
---

# 修改合同

`packages/contracts` 是前后端唯一共享的代码。顺序永远是：**合同 → 夹具 → 服务端 → Web → 测试**。

## 1. 判断变更类型

| 变更 | 类型 | 要做的事 |
| --- | --- | --- |
| 新增可选字段（`.optional()`）、新增枚举值（只被写入方使用） | 兼容 | 更新夹具 |
| 新增必填字段、删除/重命名字段、改类型、收紧校验、删除枚举值 | 破坏性 | 提升 `REPORT_SCHEMA_VERSION`（`src/report.ts`），更新夹具 |
| 修改 `analyzeInputSchema` / `analyzeOutputSchema` | 工作流接口 | 同步 CLI（`apps/loom/src/cli/main.ts`）、MCP 说明、Web 表单与 `run-state.ts` |
| 修改 `loomRoutes` 或运行摘要 | HTTP 接口 | 同步 `apps/loom/src/mastra/routes/runs.ts` 与 `apps/web/src/lib/api.ts` |

已有的 `.loom/runs/*/report.json` 不会迁移。Web 端遇到旧报告时会显示“合同不符”，这是预期行为；
需要保留旧报告时，在 Web 端加兼容解析，而不是放宽 schema。

## 2. 写法约定

- 类型只用 `z.infer`，不要手写重复的 interface。
- 给 Agent 输出的字段写 `.describe()`；它进入结构化输出提示，直接影响模型质量。
- “模型确认没有”用 `.nullable()`；“调用方可省略”用 `.optional()`。不要两者叠加。
- 引用统一用 `citationSchema`；需要被核实的引用数组字段必须叫 `citations`（`domain/citations.ts` 按字段名收集）。
- contracts 只依赖 `zod`；可以有极小的纯函数（参照 `run.ts` 的 `stepGroupOf`），不能有 I/O。

## 3. 同步清单

1. `packages/contracts/src/**`：schema 与导出；
2. `packages/contracts/src/fixtures/`：
   - `fixtureArtifacts`、`fixtureDigest`、`fixtureReport` 必须仍然通过校验；
   - `contracts.test.ts` 会检查。
3. `apps/loom`：
   - 写入方：步骤、`render.ts`、`domain/report-markdown.ts`；
   - 读取方：`routes/runs.ts`、`tools/get-report.ts`。
4. `apps/web`：
   - 读取方：`lib/api.ts`、对应 `features/report/sections/*.tsx`；
   - 新字段的展示文案放 `copy.ts`。
5. 测试：
   - 为新约束加 `contracts.test.ts` 用例；
   - Web 渲染测试用更新后的夹具。

## 4. 验证

```bash
npm test -- --project contracts
npm run typecheck        # 两端的类型错误会指出所有需要同步的位置
npm run check
```

假模式下跑一次 `npm run dev`，确认新报告能在 Web 端正常显示；如果提升了版本号，确认旧报告给出合同不符提示。

## PR 说明

- 在 PR 描述里写明变更类型（兼容 / 破坏性）。
- 如果提升了 `REPORT_SCHEMA_VERSION`，注明旧报告的影响。
- PR 模板中勾选“修改了 packages/contracts”。
