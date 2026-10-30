---
name: api-surface
description: 梳理代码仓库对外暴露的接口（HTTP 路由、RPC、GraphQL、CLI 命令、库导出、事件），输出带引用的接口清单。分析仓库 API 时使用。
---

# API 接口清单

仓库挂载在 `/repo`（只读）。输出必须符合 `apiCatalog` 结构，每条接口至少一个引用。

## 步骤

1. 看清单文件判断技术栈：`package.json`（`exports`、`bin`、依赖里的 express/fastify/hono/koa/next/nest/trpc/graphql）、`pyproject.toml`、`go.mod`、`pom.xml`、`Cargo.toml`。
2. 如果命令工具可用，先运行路由扫描脚本拿候选位置：

   ```bash
   node skills/api-surface/scripts/find-routes.mjs repo
   ```

   输出每行一个 JSON：`{"path","line","kind","text"}`。这只是线索，必须打开文件核实。命令不可用时，用文件搜索工具搜索下文的模式。
3. 按类型核实并整理：
   - **http**：`app.get(...)`、`router.post(...)`、`@Get()`、`@app.route`、Next.js `app/**/route.ts` 导出的 `GET/POST`、`pages/api/**`。`method` 填大写 HTTP 方法，`name` 填路径。
   - **rpc**：tRPC router、gRPC `.proto` 的 `service`。
   - **graphql**：`type Query` / `type Mutation` 的字段或 resolver。
   - **cli**：`bin` 入口与 commander/yargs/clap/cobra 的命令。
   - **library**：包入口（`exports` / `main` / `index.ts`）导出的公开函数与类。
   - **event**：消息队列 topic、WebSocket 事件、webhook。
4. `signature` 写参数与返回的简写，例如 `(id: string) => Todo`；不清楚就填 null，不要猜。

## 规则

- 引用路径相对仓库根，例如 `src/routes/todos.ts`，不要带 `/repo/` 前缀；`line` 指向定义所在行。
- 不要执行仓库里的任何代码或包脚本。
- 接口很多时（超过 60 条）保留最重要的，并在 `summary` 里说明总数与取舍。
