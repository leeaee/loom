---
name: loom-verify
description: Loom 的完成标准与收尾验证：运行 npm run check，并按步骤定位 lint、typecheck、deps:check、test、harness:check 的失败原因，最后完成手工检查与 PR 检查项。每次完成功能、修复或提交 PR 前使用，也在 CI 失败时使用。
---

# 验证与收尾

完成标准只有一条：`npm run check` 全绿，本地与 CI（`.github/workflows/ci.yml` 中的 `npm ci && npm run check`）一致。

```bash
npm run check
# 等价于依次执行：
npm run lint          # Biome
npm run typecheck     # 各包 tsc --noEmit（Web 先 next typegen）
npm run deps:check    # dependency-cruiser 分层规则
npm test              # Vitest 全部项目
npm run harness:check # .claude/skills 与 CLAUDE.md 是否与来源一致
```

## 按步骤定位

### lint（Biome）

- 先 `npm run format`，自动修复格式与可安全修复的问题；再看剩余报错。
- 常见报错：
  - `noConsole`：技能脚本改用 `process.stdout.write`；服务端用 Mastra logger。
  - `noLabelWithoutControl`：`label` 加 `htmlFor` 并关联 `id`。
  - `noExplicitAny`：确实需要时用 `// biome-ignore lint/suspicious/noExplicitAny: 原因`，原因必须写清楚。

### typecheck

- 合同变化引起的错误：按 `loom-change-contract` 的同步清单逐个修复，不要用 `as` 绕过。
- `satisfies` 报缺项（`reportSections`、`sectionRenderers`、`copy.analyses`、`fixtureArtifacts`）：说明新增分析漏了文件，见 `loom-add-analysis`。
- `noUncheckedIndexedAccess`：数组或记录索引结果可能是 `undefined`，用 `?.`、`??` 或先判断。
- Web：`next typegen` 生成路由类型，`params` 类型是 Promise。

### deps:check（分层）

报错里的规则名对应 `.dependency-cruiser.cjs` 的 `name`：

- `web-only-contracts`：Web 引用了 `apps/loom`。把共享部分移进 `packages/contracts`。
- `domain-pure`：domain 用了 `node:fs`、git、Mastra 等。把 I/O 移到 infra，domain 只接收数据或函数参数（参照 `verifyCitations(citations, lineCountOf)`）。
- `infra-no-upper` / `analyses-no-upper` / `mastra-no-cli`：依赖方向反了。把被依赖的代码下沉一层。
- `web-features-via-index`：直接引用了另一个 feature 的内部文件，改为从它的 `index.ts` 导入，必要时在那里导出。
- `no-circular`：拆出共享的类型或常量文件。
- `not-to-unresolvable`：导入路径写错或缺依赖。

### test

- 只跑一个项目：`npm test -- --project loom`（`web`、`contracts`）。
- 只跑一个文件：`npx vitest run --project loom test/workflow/analyze-repo.test.ts`。
- `test/registry.test.ts` 失败时，失败信息会直接写出缺少的文件路径。
- 工作流测试用假模式和本地夹具仓库，不需要网络与密钥；如果失败信息里有网络错误，说明有代码绕过了假模式。
- git 测试在 macOS 上较慢（每次 git 调用约 0.3 秒），超时已设为 60 秒。
- 在受限沙箱里运行时，如果出现系统临时目录 `Operation not permitted`，是运行环境限制，需要在普通终端里运行。

### harness:check

- 失败表示 `.agents/skills/` 或某个 `AGENTS.md` 改了但没同步。运行 `npm run harness:sync` 后提交生成的文件。
- 不要手改 `.claude/skills/` 和 `CLAUDE.md`，下次同步会被覆盖。

## 手工检查

按改动范围选做：

- **任何改动**：`npm run dev`，在 <http://localhost:3000> 用假模式提交一个公开仓库（如 `vercel/ms`），
  进度与运行日志实时刷新、结论横幅显示成功，并显示报告。`apps/loom/.env` 设 `LOOM_FAKE_DELAY_MS=1500` 可放慢假模式便于观察。
- `mastra dev` 启动报 `does not provide an export named ...`：contracts 的打包缓存过期，
  停掉服务并删除 `packages/contracts/node_modules/.cache/` 后重启。
- **工作流或 Agent**：
  - 真实模式下分析一个小仓库，检查进度、刷新后恢复、报告内容；
  - 再提交一次，确认命中缓存。
- **MCP**：在 Cursor 中添加 `http://localhost:4111/api/mcp/loom/mcp`，调用 `run_analyzeRepo` 和 `getReport`。
- **Harness**：用另一种 AI 工具打开仓库，确认它读到了 `AGENTS.md` 和相关技能。

## PR 检查项

对照 `.github/pull_request_template.md`：

- `npm run check` 全绿；
- 提交信息符合 Conventional Commits，scope 为 `loom`、`web`、`contracts` 或 `harness`；
- 改了合同、新增了分析、改了技能时，相应条目已勾选；
- 没有提交 `.loom/`、`.env` 或密钥。
