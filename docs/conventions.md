# 开发规范

根目录 `AGENTS.md` 是摘要；本文是细则。规则能由工具检查的都已写进 Biome、TypeScript、dependency-cruiser 或测试，
本文主要记录工具检查不到的约定。

## 命名

| 对象 | 规则 | 例子 |
| --- | --- | --- |
| 文件、目录 | kebab-case | `repo-sync.ts`、`run-state.test.ts` |
| 类型、接口、React 组件、类 | PascalCase | `RunState`、`ReportTabs`、`LoomError` |
| 函数、变量 | camelCase | `syncRepo`、`deriveTimeline` |
| 常量（模块级、不可变配置） | UPPER_SNAKE_CASE | `REPORT_SCHEMA_VERSION`、`SAFE_CONFIG` |
| 分析 id、运行时技能名、Web 分区文件 | kebab-case，三者一致 | `data-model` → `skills/data-model/`、`sections/data-model.tsx` |
| Agent id | `<分析 id>-agent` | `data-model-agent` |
| Zod schema | `<name>Schema`，类型同名去后缀 | `dataModelSchema` / `DataModel` |
| 开发者技能 | `loom-<动词>-<对象>` | `loom-add-analysis` |

## 模块与导出

- 每层、每个 feature 有一个 `index.ts` 作为公开出口；跨层、跨 feature 只从出口导入。
- 只用命名导出。默认导出只用在框架要求的位置：Next.js 页面与布局、配置文件。
- 类型导入写 `import type` 或 `type` 修饰（`verbatimModuleSyntax`）。
- 不使用 TypeScript `enum` 与 `namespace`；枚举用 `as const` 数组加 `z.enum`。

## 错误处理

- **domain**：业务失败返回 `Result<T>`（`ok` / `fail`），不抛异常，调用方必须处理两种情况。
  参照 `parseRepoUrl`、`checkSkillCommand`。
- **infra**：外部错误包装成 `LoomError(code, message, { cause })`，`code` 取自 `LoomErrorCode`，新增时先扩展联合类型。
  错误信息写给人看（中文、说清楚哪一步失败），并经过 `redactSecrets`。
- **工作流步骤**：
  - 分析步骤失败转换为 `StepError` 写进报告的 `errors`，不中断整个运行；
  - 只有取消（`abortSignal.aborted`）时才重新抛出；
  - 同步、scout、渲染等基础步骤失败时让运行失败，因为后续步骤无法继续。
- **Web**：
  - 请求错误交给 TanStack Query 的 `error`；
  - 合同不符抛 `ContractError` 并列出字段；
  - 404 抛 `NotFoundError`，显示专门的提示；
  - 不吞掉错误。
- 不写空的 `catch`；确实要忽略时写明原因，例如 `// 继续尝试下一个位置`。

## 日志

- 服务端用 Mastra 的 `PinoLogger`（`mastra.getLogger()` 或步骤参数中的 logger），不用 `console.*`。
  例外：CLI 的终端输出用 `console.info` / `console.error`。
- 结构化字段至少带 `runId`、`step`、`repo`（`host/owner/name`）。
- 令牌、`Authorization` 头、带凭据的 URL 一律经过 `redactSecrets`，日志和报告里都不能出现。

## 配置

- 所有环境变量在 `apps/loom/src/config/env.ts` 用 Zod 声明，带默认值和中文报错。业务代码只读 `loadConfig()`，不直接读 `process.env`。
- 新增变量要同时更新 `.env.example` 的注释。
- Web 端只有 `LOOM_SERVER_URL`（`next.config.ts`），不读任何密钥。

## 安全

- 被分析仓库的代码永远不执行：
  - git 禁用 hooks、不拉子模块；
  - 技能命令走白名单；
  - Workspace 只读；
  - Web 不渲染 HTML。
- 远程 MCP 必须设置 `allowedHosts`；外部工具默认只开只读白名单。
- 默认不接受本地路径仓库；只有测试中显式设置 `LOOM_ALLOW_LOCAL_REPOS=true` 才可以。

## 测试

| 层 | 位置 | 方式 |
| --- | --- | --- |
| contracts | `packages/contracts/src/*.test.ts` | schema 与夹具校验 |
| domain | 与源文件同目录 `*.test.ts` | 纯函数，表驱动（`it.each`） |
| infra | `apps/loom/test/infra/` | 本地夹具（`test/helpers/git-fixture.ts` 生成 file:// 仓库）、临时目录 |
| 工作流 | `apps/loom/test/workflow/` | 假模式端到端；用 `vi.mock` 注入单个分析失败 |
| 注册表 | `apps/loom/test/registry.test.ts` | 一致性检查 |
| Web | 与源文件同目录 `*.test.ts(x)` | jsdom + RTL + contracts 夹具；`fetch` 与 `mermaid` 用 mock |

- 默认测试不调用真实模型、不访问网络、不依赖开发者机器上的 git 全局配置（夹具设置 `GIT_CONFIG_GLOBAL=/dev/null`）。
- 每个测试自建并清理临时目录，不写仓库内的 `.loom/`。
- 断言行为，不断言实现细节。例如断言报告里有错误记录，而不是断言某个内部函数被调用。
- 修 bug 先写一个能复现的失败测试。

## 依赖

- 用 `npm install <pkg>@<version> -w <workspace>` 安装，版本精确锁定（`save-exact`）。只用当前最新稳定版。
- 新增依赖前先确认现有依赖不能满足需求；运行时技能脚本不能有任何第三方依赖。
- 升级由 Renovate 每周分组提交，以 `npm run check` 为门槛；手动升级 `@mastra/*` 时整组一起升级。

## 提交与 PR

- Conventional Commits，scope 取值见 `commitlint.config.ts`：
  - 各包：`loom`、`web`、`contracts`；
  - 其他：`harness`、`repo`、`deps`、`docs`、`ci`。
- 例子：`feat(loom): 新增 security-audit 分析`、`fix(web): 刷新后恢复事件订阅`。
- 一个 PR 只做一件事；合同变更、功能实现、重构分开提交。
- 提交前 lefthook 会对暂存文件跑 Biome，并在 harness 文件变化时跑 `harness:check`。
- PR 模板（`.github/pull_request_template.md`）的检查项逐条勾选；`npm run check` 未全绿不合并。

## 文档与 ADR

- 改了行为就更新相应文档：
  - `AGENTS.md` 写硬规则与入口；
  - `docs/architecture.md` 写结构与流程；
  - 技能写操作步骤。
- 改 `AGENTS.md` 或 `.agents/skills/` 后运行 `npm run harness:sync`。
- 重大选型写 ADR：`docs/adr/NNNN-<title>.md`，MADR 格式（状态、日期、背景与问题、考虑过的方案、决定、理由、代价）。
  - 已采纳的 ADR 不改写；推翻时新写一篇，并把旧文状态改为“被 NNNN 取代”。

## 注释

- 只写代码表达不了的约束和原因，例如安全边界、外部系统的怪癖、为何不用更直接的写法。
- 不写“这一行做了什么”，不写修改历史。
- 公开函数和类型可以有一行 JSDoc，说明用途与边界。
