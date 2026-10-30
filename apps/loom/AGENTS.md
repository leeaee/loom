# apps/loom（@loom/server）

Mastra 服务与 CLI。先读根目录 `AGENTS.md`，这里只写本包的局部规则。

## 分层与入口

| 目录 | 职责 | 可以依赖 |
| --- | --- | --- |
| `src/config` | Zod 校验环境变量（`loadConfig`） | 无 |
| `src/domain` | 纯函数；业务失败返回 `Result` | `@loom/contracts` |
| `src/infra` | git、Workspace/Sandbox、MCP 客户端、运行存储、文件锁 | domain、config |
| `src/analyses` | 分析模块与注册表 | infra、domain、config |
| `src/mastra` | 组合根：`new Mastra(...)`、工作流、工具、MCP 服务、HTTP 路由 | 以上全部 |
| `src/cli` | `npm run cli -- analyze <url>` | mastra |

- Mastra 入口是 `src/mastra/index.ts`，`mastra dev` / `mastra build` 从这里读取。
- 工作流 `analyze-repo` 的阶段：同步、scout、模块摘要（大仓库）或跳过、并行分析、顾问、渲染。
  并行段由 `analyses/registry.ts` 的 `phase` 自动生成，新增分析不用改工作流。
- 每次运行的资源（Workspace、沙箱、MCP 连接）由 `infra/run-resources.ts` 按 `runId` 懒创建，
  工作流结束时在 `options.onFinish` 统一释放。

## 运行时技能（`skills/`）

- 每个技能目录名 = frontmatter `name` = 分析 id（`module-digest` 例外，它是预处理）。
- 技能只读：Agent 通过 `/repo`、`/skills` 两个只读挂载访问文件。
- 脚本放在 `skills/<name>/scripts/`，只用 Node 内置模块，按 `node skills/<name>/scripts/x.mjs repo` 调用；
  `command-policy.ts` 之外的命令都会被拦截，沙箱断网。
- 修改技能会改变缓存键（技能目录哈希），旧报告不再命中。
- 写技能前读 `loom-write-runtime-skill`。

## 假模式

`LOOM_AGENT_MODE=fake` 时 `runAnalysisAgent` 直接返回 `@loom/contracts/fixtures` 的夹具；git 同步与 scout 仍真实执行。
新增分析必须同时提供夹具，否则假模式与测试都会失败。`LOOM_FAKE_DELAY_MS` 给每次假调用加上模拟耗时，便于在界面上观察进度。

## 运行日志

- 步骤里用 `createRunLogger({ runId, step, writer, logger: mastra?.getLogger() })` 写用户可见的进度日志（中文、一句话），
  不要直接 `writer.write` 或 `console`。日志同时推给前端、写进 `.loom/runs/<runId>/logs.jsonl`，并经过 `redactSecrets`。
- `step` 用工作流步骤 id 或分析 id；模块摘要用 `digest:<module>`，前端据此归到对应阶段。
- 每个步骤至少记录开始/结果；失败写 `error`，降级或部分失败写 `warn`。
- 读写磁盘的步骤要在日志里写出绝对路径（检出目录、报告、缓存文件、沙箱目录），用户据此找到产物。

## 模型

- `LOOM_MODEL`（`provider/model`）走 Mastra 模型路由；同时设置 `LOOM_MODEL_URL` 时改走 OpenAI 兼容接口，
  此时 Mastra 只用 `LOOM_MODEL_API_KEY`，不再读 provider 的 `*_API_KEY`；发给接口的模型名是去掉 provider 前缀后的部分。解析集中在 `analyses/shared/create-agent.ts` 的 `resolveModel`。
- 报告与缓存键里的模型标识用 `modelLabel(config)`：换了接口地址视为不同模型。
- `GET /loom/runtime` 返回当前模式、模型、接口地址与数据目录给首页展示，不含密钥。

## mastra dev 与 contracts

`mastra dev` 会把 `@loom/contracts` 打包缓存到 `packages/contracts/node_modules/.cache/`。改了 contracts 的导出后若启动报
`does not provide an export named ...`，停掉服务、删除该目录再重新 `npm run dev`。

## 错误

- infra 抛 `LoomError(code, message)`，`code` 取自 `domain/errors.ts` 的 `LoomErrorCode`，新增时先加到联合类型。
- 分析步骤捕获异常并返回 `{ artifact: null, error }`，只有取消时才重新抛出。
- 错误信息进入报告和日志前经过 `redactSecrets`。

## 测试

- `src/domain/**/*.test.ts`：纯函数单测，与源文件同目录。
- `test/infra`：本地夹具 git 仓库（`test/helpers/git-fixture.ts`）、Workspace 与命令钩子。
- `test/workflow`：假模式端到端，`vi.stubEnv` 设置 `LOOM_DATA_DIR` 等后再动态导入 `src/mastra/index`。
- `test/registry.test.ts`：注册表一致性。
- 运行：`npm test -- --project loom`。git 测试在 macOS 上较慢（每次 git 调用约 0.3 秒），超时已放宽到 60 秒。
