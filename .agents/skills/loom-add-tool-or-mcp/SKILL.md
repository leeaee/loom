---
name: loom-add-tool-or-mcp
description: 给 Loom 新增 Mastra 工具（createTool）、接入外部 MCP 服务并配置工具白名单、或把新能力暴露到 Loom 自己的 MCP 服务（/api/mcp/loom/mcp）。需要让分析 Agent 获得新能力、或让 Cursor 等客户端调用 Loom 新功能时使用。
---

# 新增工具或 MCP

先判断要做的是哪一种：

| 需求 | 位置 | 参照 |
| --- | --- | --- |
| 分析 Agent 需要调用一个外部 MCP 服务 | `apps/loom/src/infra/mcp/` | `servers.ts`、`run-toolsets.ts` |
| 写一个自定义工具（读本地数据、调用 API） | `apps/loom/src/mastra/tools/` | `get-report.ts` |
| 让外部 MCP 客户端调用 Loom 的新能力 | `apps/loom/src/mastra/mcp/server.ts` | `loomMcpServer` |

## A. 接入外部 MCP 服务（给分析 Agent 用）

1. 在 `infra/mcp/servers.ts` 加一个返回 `MastraMCPServerDefinition` 的工厂函数：
   - **远程**：`{ url: new URL(...), requestInit: { headers }, allowedHosts: [...], timeout }`，参照 `githubServer`。
     令牌从参数传入，不要在这里读环境变量。
   - **stdio**：`{ command, args, timeout }`，参照 `tsLanguageServer`。
     优先解析本地依赖，找不到时用 `npx -y <pkg>@<精确版本>`。
2. **工具白名单**：
   - 在 `servers.ts` 导出工具名常量（参照 `TS_LANGUAGE_TOOLS`），并加进 `run-toolsets.ts` 的 `TOOL_ALLOWLIST`；
   - 只放行只读工具，会写盘、改远端状态的工具一律不放行。
3. 在 `run-toolsets.ts` 的 `openRunToolsets` 里按条件加入 `servers`：
   - 条件来自 `OpenRunToolsetsInput`（例如 `hasTsconfig`、`githubToken`）；
   - 需要新条件时，同步修改 `infra/run-resources.ts` 与 `analyses/shared/run-agent.ts` 的调用处。
4. 连接失败只记录到 `errors`，不能让分析失败；`listToolsetsWithErrors` 已经保证这一点。
5. 新的环境变量：
   - 加到 `apps/loom/src/config/env.ts` 的 schema 与 `LoomConfig`；
   - 在 `.env.example` 写注释说明。
6. 依赖：
   - stdio 服务的 npm 包用精确版本：`npm install <pkg>@<version> -w @loom/server`；
   - 如果 Mastra 打包器不能处理它，加进 `apps/loom/src/mastra/index.ts` 的 `bundler.externals`（参照 `ts-language-mcp`）。
7. 测试：在 `apps/loom/test/infra/run-toolsets.test.ts` 为白名单加用例。默认测试不连接真实服务。

## B. 自定义工具

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const fooTool = createTool({
  id: "foo",
  description: "给模型看的说明：做什么、什么时候用、返回什么",
  inputSchema: z.object({ runId: z.string().min(1).describe("…") }),
  outputSchema: z.object({ /* … */ }),
  execute: async ({ runId }) => { /* 调用 infra，不直接操作 git/文件 */ },
});
```

- 输入输出都用 Zod；跨前后端共享的结构放 `packages/contracts`。
- 工具属于组合根（`src/mastra/tools/`），可以依赖 infra 与 `src/mastra/runtime.ts` 的单例。
- 给分析 Agent 用：
  - 在 `analyses/shared/create-agent.ts` 的 `new Agent({ tools })` 中加入；
  - 但 analyses 层不能依赖 mastra 层，所以工具实现要放到 `infra` 或 `analyses/shared`。

## C. 暴露到 Loom 的 MCP 服务

- 在 `src/mastra/mcp/server.ts` 的 `tools` 或 `workflows` 中加入。
  - 工作流会以 `run_<key>` 的名字暴露。
  - 同步更新 `instructions` 里的调用顺序说明。
- 服务地址 `http://localhost:4111/api/mcp/loom/mcp`，`legacy: "stateless"` 保持不变，兼容 Cursor 等客户端。
- 手工验证：`npm run dev` 后在 Cursor 的 MCP 设置里添加该地址，调用新工具。

## 安全规则

- 令牌只放请求头，不拼进 URL；错误信息经 `redactSecrets`。
- 远程服务必须设置 `allowedHosts`。
- 被分析仓库的代码不能经由任何工具被执行。

## 收尾

```bash
npm test -- --project loom
npm run check
```
