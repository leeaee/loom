import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  type AnyWorkspace,
  LocalFilesystem,
  LocalSandbox,
  WORKSPACE_TOOLS,
  Workspace,
  type WorkspaceToolHooks,
  type WorkspaceToolsConfig,
} from "@mastra/core/workspace";
import { checkSkillCommand } from "../../domain/index";

export const REPO_MOUNT = "/repo";
export const SKILLS_MOUNT = "/skills";

export type RunWorkspaceInput = {
  runId: string;
  checkoutDir: string;
  skillsDir: string;
  scratchRoot: string;
  /** 测试用：强制关闭沙箱命令 */
  disableCommands?: boolean;
};

export type RunWorkspace = {
  workspace: AnyWorkspace;
  scratchDir: string;
  /** 检测不到 seatbelt / bwrap 时为 false，技能退化为只读指令 */
  commandsEnabled: boolean;
  isolation: string;
  dispose: () => Promise<void>;
};

const F = WORKSPACE_TOOLS.FILESYSTEM;

/** 只有命令工具会被拦截检查；其他工具放行。 */
export const commandHooks: WorkspaceToolHooks = {
  beforeToolCall: ({ workspaceToolName, input }) => {
    if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
    const args = (input ?? {}) as { command?: unknown; cwd?: unknown; background?: unknown };
    if (args.cwd || args.background) {
      return { proceed: false, output: "命令被拒绝：不允许指定 cwd 或后台运行" };
    }
    const checked = checkSkillCommand(typeof args.command === "string" ? args.command : "");
    if (!checked.ok) return { proceed: false, output: checked.error.message };
  },
};

function toolsConfig(commandsEnabled: boolean): WorkspaceToolsConfig {
  return {
    hooks: commandHooks,
    [F.WRITE_FILE]: { enabled: false },
    [F.EDIT_FILE]: { enabled: false },
    [F.DELETE]: { enabled: false },
    [F.MKDIR]: { enabled: false },
    [F.AST_EDIT]: { enabled: false },
    [F.APPLY_PATCH]: { enabled: false },
    [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { enabled: commandsEnabled },
    [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS]: { enabled: false },
  };
}

/**
 * 每次运行一个 Workspace：
 * - `/repo` 挂被分析仓库，`/skills` 挂运行时技能，都只读；
 * - 命令在 LocalSandbox（seatbelt / bwrap、断网）里执行，只放行技能 scripts/ 下的脚本；
 * - 目标仓库的代码一律不执行。
 */
export async function createRunWorkspace(input: RunWorkspaceInput): Promise<RunWorkspace> {
  const scratchDir = join(input.scratchRoot, input.runId);
  await mkdir(scratchDir, { recursive: true });

  const detection = LocalSandbox.detectIsolation();
  const commandsEnabled = !input.disableCommands && detection.available && detection.backend !== "none";

  const workspace = new Workspace({
    id: `loom-run-${input.runId}`,
    name: `Loom run ${input.runId}`,
    mounts: {
      [REPO_MOUNT]: new LocalFilesystem({ basePath: input.checkoutDir, readOnly: true }),
      [SKILLS_MOUNT]: new LocalFilesystem({ basePath: input.skillsDir, readOnly: true }),
    },
    skills: [SKILLS_MOUNT],
    ...(commandsEnabled
      ? {
          sandbox: new LocalSandbox({
            id: `loom-sandbox-${input.runId}`,
            workingDirectory: scratchDir,
            isolation: detection.backend,
            timeout: 60_000,
            nativeSandbox: { allowNetwork: false, readOnly: true, readWritePaths: [scratchDir] },
          }),
        }
      : {}),
    tools: toolsConfig(commandsEnabled),
  });
  await workspace.init();

  return {
    workspace,
    scratchDir,
    commandsEnabled,
    isolation: commandsEnabled ? detection.backend : "none",
    dispose: async () => {
      await workspace.destroy();
      await rm(scratchDir, { recursive: true, force: true });
    },
  };
}
