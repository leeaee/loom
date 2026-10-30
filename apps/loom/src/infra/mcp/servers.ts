import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { MastraMCPServerDefinition } from "@mastra/mcp";

/** GitHub 远程 MCP：只开 repos 工具集的只读版本（见 github/github-mcp-server docs/remote-server.md）。 */
export const GITHUB_MCP_URL = "https://api.githubcopilot.com/mcp/x/repos/readonly";

export function githubServer(token: string): MastraMCPServerDefinition {
  return {
    url: new URL(GITHUB_MCP_URL),
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    allowedHosts: ["api.githubcopilot.com"],
    timeout: 30_000,
  };
}

/** ts-language-mcp 中只读的工具；会写盘的 rename_symbol、apply_code_fix 等不放行。 */
export const TS_LANGUAGE_TOOLS = [
  "get_symbols",
  "get_outline",
  "get_imports",
  "get_definition",
  "get_references",
  "get_call_hierarchy",
  "get_type_hierarchy",
  "get_workspace_symbols",
  "find",
] as const;

export const TS_LANGUAGE_MCP_VERSION = "2.3.1";

function resolveTsLanguageBin(searchFrom: readonly string[]): string | null {
  for (const base of searchFrom) {
    try {
      const pkg = createRequire(join(base, "noop.js")).resolve("ts-language-mcp/package.json");
      const bin = join(dirname(pkg), "dist", "index.js");
      if (existsSync(bin)) return bin;
    } catch {
      // 继续尝试下一个位置
    }
  }
  return null;
}

/** 以 stdio 启动 ts-language-mcp，分析目录即被分析仓库的检出目录。优先用本地依赖，找不到时退回 npx。 */
export function tsLanguageServer(
  checkoutDir: string,
  searchFrom: readonly string[],
): MastraMCPServerDefinition {
  const bin = resolveTsLanguageBin(searchFrom);
  return bin
    ? { command: process.execPath, args: [bin, checkoutDir], timeout: 60_000 }
    : {
        command: "npx",
        args: ["-y", `ts-language-mcp@${TS_LANGUAGE_MCP_VERSION}`, checkoutDir],
        timeout: 120_000,
      };
}
