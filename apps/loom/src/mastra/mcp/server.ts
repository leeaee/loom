import { MCPServer } from "@mastra/mcp";
import { getReportTool } from "../tools/get-report";
import { analyzeRepoWorkflow } from "../workflows/analyze-repo";

/**
 * 把 Loom 暴露为 MCP 服务：`run_analyzeRepo` 与 `getReport`。
 * 地址：http://localhost:4111/api/mcp/loom/mcp。
 * legacy: "stateless" 让 Cursor、VS Code 等仍使用 2025 协议的客户端也能连接。
 */
export const loomMcpServer = new MCPServer({
  id: "loom",
  name: "Loom",
  version: "0.1.0",
  description: "代码理解 Agent：同步 Git 仓库并生成 API、数据结构、架构流程与技术选型报告",
  instructions: "先调用 run_analyzeRepo 传入 repoUrl，拿到 runId 后调用 getReport 读取报告。",
  tools: { getReport: getReportTool },
  workflows: { analyzeRepo: analyzeRepoWorkflow },
  legacy: "stateless",
});
