---
name: loom-add-analysis
description: 在 Loom 中新增一种代码分析（例如安全审计、依赖升级建议、测试覆盖概览），覆盖 contracts 产物 schema、夹具、运行时技能、Agent 与步骤、注册表、Markdown 渲染、Web 报告分区和测试。用户要求“加一个分析/报告板块/新 Agent 分析某方面”时使用。
---

# 新增一种分析

分析模块是 Loom 唯一的扩展点。工作流的并行段由注册表自动生成，**不要改 `analyze-repo.ts`**。
全程以 `data-model`（analyze 阶段）和 `tech-choice`（advise 阶段）为参照。

## 0. 先确定

- **id**：kebab-case，同时用作技能名与 Web 分区文件名，例如 `security-audit`。
- **phase**：
  - `analyze`：只看仓库，与其他分析并行。
  - `advise`：在所有 analyze 完成后运行，能读取前序产物（参照 `tech-choice`）。
- **产物结构**：每条结论都要带 `citations`（`citationSchema`，至少 1 条），引用核实会自动收集。

## 1. 合同（packages/contracts）

1. 新建 `packages/contracts/src/analyses/<id>.ts`，参照 `data-model.ts`：
   - 导出 `<name>Schema` 与 `type <Name> = z.infer<...>`。
   - 给模型需要理解的字段写 `.describe()`；“没有”用 `.nullable()`。
2. 在 `packages/contracts/src/analyses/index.ts`：
   - `export * from "./<id>"`；
   - 把 id 加进 `analysisIds`（顺序即报告标签页顺序）；
   - 在 `analysisDefinitions` 和 `artifactsSchema` 各加一项（后者用 `.optional()`）。
3. 在 `packages/contracts/src/fixtures/artifacts.ts` 的 `fixtureArtifacts` 加一份合法夹具：
   - 引用要指向**夹具报告里存在的文件**；
   - 类型 `{ [Id in AnalysisId]: ArtifactOf<Id> }` 会强制你补上。

## 2. 运行时技能（apps/loom/skills）

新建 `apps/loom/skills/<id>/SKILL.md`，frontmatter `name: <id>`，写法见技能 `loom-write-runtime-skill`。
参照 `apps/loom/skills/data-model/SKILL.md`。

## 3. Agent 与步骤（apps/loom/src/analyses/<id>/）

```text
agent.ts   createAnalysisAgent({ id: "<id>-agent", name, description, skill: "<id>", instructions })
step.ts    analyze：createAnalyzeStep({ id: "<id>", description, agent, buildPrompt: ({ ctx, digests }) => ... })
           advise ：createAdviseStep({ ..., buildPrompt: ({ ctx, digests, artifacts, errors }) => ... })
index.ts   export const <name>Module = { id, title, skill, phase, agent, step } satisfies AnalysisModule<"<id>">
```

- 参照文件：
  - analyze 阶段：`apps/loom/src/analyses/data-model/{agent,step,index}.ts`；
  - advise 阶段：`apps/loom/src/analyses/tech-choice/step.ts`。
- 提示词：用 `shared/prompt.ts` 的 `repoContext(ctx, digests)`、`artifactsContext(artifacts)`，结尾写明“按 `<id>` 技能输出”。
- `instructions` 只写本分析的任务与取舍规则；通用规则（只读、引用格式、中文）已在 `create-agent.ts` 的基础指令里。
- 步骤会自动处理：
  - 假模式返回夹具；
  - 真实模式下结构化输出与一次重试；
  - 失败写入 `errors`。

  不要在步骤里自己 try/catch。

## 4. 注册

- `apps/loom/src/analyses/registry.ts`：把模块加进 `analysisModules`，**顺序与 `analysisIds` 一致**。
- `apps/loom/src/domain/report-markdown.ts`：在 `sectionRenderers` 加 `{ title, render }`，类型会强制补齐。

## 5. Web 报告分区（apps/web）

1. 新建 `apps/web/src/features/report/sections/<id>.tsx`，导出 `<Name>Section({ artifact }: SectionProps<"<id>">)`。
   - 参照 `sections/data-model.tsx`（卡片）或 `sections/api-surface.tsx`（TanStack Table）。
   - 引用用 `../citations` 的 `<Citations citations={...} />`。
   - 模型文本按纯文本渲染。
2. `sections/registry.ts` 加一项（`satisfies` 会强制补齐）。
3. `apps/web/src/lib/copy.ts`：
   - `copy.analyses` 加标签页名；
   - 分区里用到的列名、标题也放进 `copy.report`。

时间线不用改：`stepGroupOf` 按 `analysisDefinitions` 的 phase 自动归组。

## 6. 测试与收尾

- `apps/loom/test/registry.test.ts` 会检查模块、技能、Web 分区是否齐全，不用改。
- 如果产物有特殊约束（例如 refine），在 `packages/contracts/src/contracts.test.ts` 加用例。
- 运行：

  ```bash
  npm test -- --project contracts
  npm test -- --project loom
  npm test -- --project web
  npm run check
  ```

- 手工：
  1. `LOOM_AGENT_MODE=fake npm run dev`；
  2. 在 <http://localhost:3000> 提交一个仓库，确认新标签页显示夹具；
  3. 有模型密钥时再用真实模式跑一个小仓库。

## 检查清单

- [ ] contracts：schema、`analysisIds`、`analysisDefinitions`、`artifactsSchema`、夹具
- [ ] `apps/loom/skills/<id>/SKILL.md`，name 与目录一致
- [ ] `apps/loom/src/analyses/<id>/{agent,step,index}.ts` 与 `registry.ts`
- [ ] `report-markdown.ts` 的 `sectionRenderers`
- [ ] Web 分区、分区注册表、`copy.ts`
- [ ] `npm run check` 全绿
