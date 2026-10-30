import type { MastraMCPServerDefinition } from "@mastra/mcp";
import { MCPClient } from "@mastra/mcp";
import { githubServer, TS_LANGUAGE_TOOLS, tsLanguageServer } from "./servers";

// biome-ignore lint/suspicious/noExplicitAny: MCP 工具的输入输出由远端声明，这里只做透传。
export type Toolsets = Record<string, Record<string, any>>;

export type RunToolsets = {
  toolsets: Toolsets;
  /** 成功连接的服务名 */
  connected: string[];
  /** 连接失败的服务与原因（不影响运行，只记录） */
  errors: Record<string, string>;
  close: () => Promise<void>;
};

export type OpenRunToolsetsInput = {
  runId: string;
  checkoutDir: string;
  repoHost: string;
  hasTsconfig: boolean;
  githubToken: string | null;
  /** 解析 ts-language-mcp 依赖的起点目录 */
  resolveFrom: readonly string[];
};

/** 每个服务允许的工具名；不在表里的服务不做额外过滤。 */
export const TOOL_ALLOWLIST: Record<string, readonly string[]> = {
  tsLanguage: TS_LANGUAGE_TOOLS,
};

export function filterToolsets(toolsets: Toolsets, allowlist = TOOL_ALLOWLIST): Toolsets {
  return Object.fromEntries(
    Object.entries(toolsets).map(([server, tools]) => {
      const allowed = allowlist[server];
      return [
        server,
        allowed ? Object.fromEntries(Object.entries(tools).filter(([n]) => allowed.includes(n))) : tools,
      ];
    }),
  );
}

const EMPTY: RunToolsets = { toolsets: {}, connected: [], errors: {}, close: async () => {} };

/**
 * 为一次运行连接外部 MCP：有 GITHUB_TOKEN 且仓库在 github.com 时接 GitHub（只读 repos）；
 * 仓库含 tsconfig.json 时以 stdio 启动 ts-language-mcp。连接失败只记录，不中断分析。
 */
export async function openRunToolsets(input: OpenRunToolsetsInput): Promise<RunToolsets> {
  const servers: Record<string, MastraMCPServerDefinition> = {};
  if (input.githubToken && input.repoHost === "github.com") servers.github = githubServer(input.githubToken);
  if (input.hasTsconfig) servers.tsLanguage = tsLanguageServer(input.checkoutDir, input.resolveFrom);
  if (Object.keys(servers).length === 0) return EMPTY;

  const client = new MCPClient({ id: `loom-run-${input.runId}`, servers, registerProcessHooks: false });
  try {
    const { toolsets, errors } = await client.listToolsetsWithErrors({ perServerTimeoutMs: 60_000 });
    return {
      toolsets: filterToolsets(toolsets as Toolsets),
      connected: Object.keys(toolsets),
      errors,
      close: () => client.disconnect(),
    };
  } catch (error) {
    await client.disconnect().catch(() => {});
    return { ...EMPTY, errors: { mcp: error instanceof Error ? error.message : String(error) } };
  }
}
