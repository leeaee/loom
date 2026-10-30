# 0001 用 Mastra 作为 Agent 运行时

- 状态：已采纳
- 日期：2026-10-29

## 背景与问题

Loom 需要：可执行 `SKILL.md` 的成熟 Agent、多步编排（分支、并行、foreach、缓存短路）、MCP 客户端与服务端、
技能脚本沙箱，以及调试界面。全部用 TypeScript 实现，后续开发者能低成本扩展新的 Agent、技能与工具。

## 考虑过的方案

1. **Mastra**（`@mastra/core` 1.x，Apache-2.0，底层 AI SDK）
2. **LangGraph.js + AI SDK + 自写技能加载器与沙箱**
3. **完全自研**：AI SDK 的 `generateText` + 自写图编排

## 决定

选择 Mastra。

## 理由

- 一个框架覆盖全部需求：Agent、工作流（`.branch` / `.parallel` / `.foreach` / `bail`）、Workspace 原生发现 `SKILL.md`、
  LocalSandbox（seatbelt / bubblewrap）、`MCPClient` 与 `MCPServer`、Studio。
- 和方案 2 相比只需学一套概念，自写代码约少一半；技能、沙箱、MCP 不用自己维护。
- 工作流事件流（`observe`）与快照（`runById`）由 `@mastra/client-js` 直接提供，前端进度与刷新恢复不需要自写协议。
- 结构化输出直接接受 Zod schema，与 `packages/contracts` 共用一份定义。

## 代价与应对

- **发版很快**：所有 `@mastra/*` 精确锁定，Renovate 每周分组升级，`npm run check` 作为合并门槛。
- **企业许可目录**：带 `ee/` 的功能不使用。
- **图能力弱于 LangGraph 底层**：需要任意环路时，可以让单个步骤调用 LangGraph 子图，不影响其他部分。
- **本地沙箱**：macOS seatbelt 允许读全盘，只适合本机单用户；团队部署时换远程沙箱（第二阶段）。
