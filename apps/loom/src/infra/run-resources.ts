import { openRunToolsets, type RunToolsets } from "./mcp/index";
import { createRunWorkspace, type RunWorkspace } from "./workspace/run-workspace";

export type RunResourceSpec = {
  runId: string;
  checkoutDir: string;
  repoHost: string;
  hasTsconfig: boolean;
  skillsDir: string;
  scratchRoot: string;
  githubToken: string | null;
  resolveFrom: readonly string[];
};

export type RunResources = {
  workspace: RunWorkspace;
  mcp: RunToolsets;
};

const resources = new Map<string, Promise<RunResources>>();

/**
 * 取得某次运行的 Workspace 与 MCP 工具；首次调用时创建，并行步骤共享同一份。
 * 进程重启后（例如恢复运行）会按 spec 重新创建。
 */
export function acquireRunResources(spec: RunResourceSpec): Promise<RunResources> {
  let pending = resources.get(spec.runId);
  if (!pending) {
    pending = (async () => {
      const [workspace, mcp] = await Promise.all([
        createRunWorkspace({
          runId: spec.runId,
          checkoutDir: spec.checkoutDir,
          skillsDir: spec.skillsDir,
          scratchRoot: spec.scratchRoot,
        }),
        openRunToolsets(spec),
      ]);
      return { workspace, mcp };
    })();
    pending.catch(() => resources.delete(spec.runId));
    resources.set(spec.runId, pending);
  }
  return pending;
}

/** Agent 的动态 workspace 解析：只返回已创建的资源，不会隐式创建。 */
export async function peekRunWorkspace(runId: string | undefined) {
  if (!runId) return undefined;
  const pending = resources.get(runId);
  return pending ? (await pending).workspace.workspace : undefined;
}

export async function releaseRunResources(runId: string): Promise<void> {
  const pending = resources.get(runId);
  if (!pending) return;
  resources.delete(runId);
  const { workspace, mcp } = await pending;
  await Promise.allSettled([workspace.dispose(), mcp.close()]);
}
