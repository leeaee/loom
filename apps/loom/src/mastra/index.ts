import { mkdirSync } from "node:fs";
import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { analysisAgents } from "../analyses/index";
import { loadConfig } from "../config/index";
import { loomMcpServer } from "./mcp/server";
import { loomApiRoutes } from "./routes/runs";
import { analyzeRepoWorkflow } from "./workflows/analyze-repo";

const config = loadConfig();
mkdirSync(config.paths.dataDir, { recursive: true });

/**
 * 组合根：注册 Agent、工作流、MCP 服务与 Loom 自有路由。
 * `mastra dev` 与 CLI 都从这里取得同一个实例。
 */
export const mastra = new Mastra({
  agents: analysisAgents,
  workflows: { [analyzeRepoWorkflow.id]: analyzeRepoWorkflow },
  mcpServers: { loom: loomMcpServer },
  storage: new LibSQLStore({ id: "loom-storage", url: config.paths.databaseUrl }),
  logger: new PinoLogger({ name: "Loom", level: config.logLevel }),
  server: { apiRoutes: loomApiRoutes },
  bundler: { externals: ["ts-language-mcp"] },
});
