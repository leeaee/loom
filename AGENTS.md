# Loom

Loom 是一个代码理解 Agent：同步 Git 仓库，按运行时技能（`SKILL.md`）分析 API、数据结构、架构流程，
再给出技术选型建议，输出带引用核实的报告。运行时基于 Mastra，界面是 Next.js。

本文件是所有 AI 工具（Cursor、Codex、Copilot、Claude Code、Gemini CLI）和开发者共同遵守的规范。
包内还有各自的 `AGENTS.md`，只写本包的局部规则。

## 目录地图

```text
packages/contracts/   Zod 合同：前后端唯一共享的代码（产物 schema、报告、运行状态、夹具）
apps/loom/            Mastra 服务（4111）+ CLI，包名 @loom/server
  src/config/           环境变量校验
  src/domain/           纯逻辑：URL 解析、scout、缓存键、引用核实、Markdown 渲染
  src/infra/            外部适配：simple-git、Workspace/Sandbox、MCP 客户端、运行存储
  src/analyses/         分析模块（唯一扩展点）与注册表
  src/mastra/           组合根：Mastra 实例、工作流、工具、MCP 服务、HTTP 路由
  src/cli/              命令行入口
  skills/               运行时技能（给 Loom 的 Agent 用，不是开发者技能）
apps/web/             Next.js 16 界面（3000），包名 @loom/web
docs/                 architecture.md、conventions.md、adr/
.agents/skills/       开发者技能（唯一来源）
.claude/skills/       由 harness-sync 生成，禁止手改
scripts/              harness-sync.ts
```

## 命令

| 场景 | 命令 |
| --- | --- |
| 安装 | `npm ci` |
| 同时启动 Mastra 与 Web | `npm run dev` |
| 完成标准（合并前必须全绿） | `npm run check` |
| 单个测试项目 | `npm test -- --project loom`（或 `web`、`contracts`） |
| 格式化 | `npm run format` |
| 新增依赖 | `npm install <pkg>@<version> -w <workspace>`，例如 `-w @loom/web` |
| CLI 分析 | `npm run cli -w @loom/server -- analyze <git-url> [--ref <ref>] [--force]` |
| 同步 harness | `npm run harness:sync` |

`npm run check` 依次执行 `lint`（Biome）、`typecheck`（各包 `tsc --noEmit`）、`deps:check`
（dependency-cruiser 分层规则）、`test`（Vitest）、`harness:check`。

新克隆后执行 `cp .env.example apps/loom/.env`：默认 `LOOM_AGENT_MODE=fake`，不需要模型密钥就能端到端跑通。

## 硬规则

1. **只用 npm**。不提交其他包管理器的锁文件；依赖精确锁定（`.npmrc` 已设 `save-exact=true`）。
   包之间用 `"@loom/contracts": "*"` 引用，不用 `workspace:` 协议。
2. **合同先行**。跨前后端的数据结构先改 `packages/contracts`，同步更新夹具，再改两端。
3. **分层**。规则写在 `.dependency-cruiser.cjs`，违反即 CI 失败：
   - `contracts` 只依赖 `zod`；`apps/web` 只能依赖 `@loom/contracts`，不能引用 `apps/loom`。
   - `domain` 是纯逻辑：不依赖 Mastra、git、网络，不读写文件。
   - `infra` 不依赖 `analyses`/`mastra`；`analyses` 不依赖 `mastra`/`cli`；只有 `mastra` 和 `cli` 组装各层。
   - `apps/web/src/features/*` 之间只能经对方的 `index.ts` 引用。
   - 禁止循环依赖。
4. **不执行被分析仓库的代码**。git 调用一律禁用 hooks；技能命令只能运行 `skills/<name>/scripts/` 下的脚本，
   且在断网沙箱里执行（见 `apps/loom/src/domain/command-policy.ts`）。
5. **不提交** `.loom/`、`.env`、令牌或任何密钥。日志与错误信息里的令牌必须经 `redactSecrets` 脱敏。
6. **`.claude/skills/` 与各级 `CLAUDE.md` 由脚本生成**，改 `.agents/skills/` 或 `AGENTS.md` 后运行 `npm run harness:sync`。
7. **默认测试不调用真实模型、不访问网络**。工作流测试用假模式，git 测试用本地夹具仓库。
8. **合并前 `npm run check` 必须全绿**。

## 新增分析的接入点

新增一种分析（例如安全审计）只按下面的清单加文件，不改工作流代码：

```text
packages/contracts/src/analyses/<id>.ts          产物 schema；把 id 加进 analysisIds 与 analysisDefinitions
packages/contracts/src/fixtures/artifacts.ts     假模式夹具
apps/loom/skills/<id>/SKILL.md                   运行时技能（frontmatter name 与目录名一致）
apps/loom/src/analyses/<id>/{agent,step,index}.ts
apps/loom/src/analyses/registry.ts               注册
apps/web/src/features/report/sections/<id>.tsx   报告分区
apps/web/src/features/report/sections/registry.ts
apps/web/src/lib/copy.ts                         标签页文案
```

`apps/loom/test/registry.test.ts` 会指出缺了哪一块。完整步骤见技能 `loom-add-analysis`。

## 常见任务对应的技能

技能在 `.agents/skills/`（Claude Code 读 `.claude/skills/` 的副本）。开始任务前先读对应技能：

| 任务 | 技能 |
| --- | --- |
| 新增一种分析 | `loom-add-analysis` |
| 编写或修改 `apps/loom/skills` 下的运行时技能 | `loom-write-runtime-skill` |
| 新增工具、接入外部 MCP、扩展 Loom 的 MCP 服务 | `loom-add-tool-or-mcp` |
| 新增页面、feature 切片或 shadcn 组件 | `loom-add-ui-feature` |
| 修改 `packages/contracts` | `loom-change-contract` |
| 收尾验证、定位 `npm run check` 失败 | `loom-verify` |

## 代码约定（摘要）

- 文件 kebab-case；类型与组件 PascalCase；分析 id 与技能名 kebab-case 且一致。
- domain 返回 `Result` 对象，不抛业务异常；infra 把外部错误包装成带 `code` 的 `LoomError`；
  分析步骤失败写进报告的 `errors`，不中断整个运行。
- 用户可见文案用中文，Web 端集中放在 `apps/web/src/lib/copy.ts`。
- 注释只写代码本身表达不了的约束，不写“做了什么”。
- 依赖使用当前最新稳定版并精确锁定；Renovate 每周统一升级。

详细规范见 `docs/conventions.md`，架构见 `docs/architecture.md`，重大选型见 `docs/adr/`。
