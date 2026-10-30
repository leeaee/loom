import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { analysisIds } from "@loom/contracts";
import { WORKSPACE_TOOLS } from "@mastra/core/workspace";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commandHooks, createRunWorkspace, type RunWorkspace } from "../../src/infra/index";
import { tempDir } from "../helpers/git-fixture";

const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));

function callHook(workspaceToolName: string, input: unknown) {
  return commandHooks.beforeToolCall?.({
    toolName: workspaceToolName,
    workspaceToolName: workspaceToolName as never,
    input,
    context: {},
  });
}

describe("commandHooks", () => {
  const exec = WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND;

  it("lets non-command tools through", () => {
    expect(callHook(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, { path: "/repo/x" })).toBeUndefined();
  });

  it("allows skill scripts", () => {
    expect(
      callHook(exec, { command: "node skills/api-surface/scripts/find-routes.mjs repo" }),
    ).toBeUndefined();
  });

  it.each([
    { command: "npm install" },
    { command: "node repo/index.js" },
    { command: "node skills/api-surface/scripts/find-routes.mjs repo; rm -rf /" },
    { command: "node skills/api-surface/scripts/find-routes.mjs repo", cwd: "/tmp" },
    { command: "node skills/api-surface/scripts/find-routes.mjs repo", background: true },
  ])("rejects %o", (input) => {
    expect(callHook(exec, input)).toMatchObject({ proceed: false });
  });
});

describe("createRunWorkspace", () => {
  let tmp: ReturnType<typeof tempDir>;
  let run: RunWorkspace;

  beforeAll(async () => {
    tmp = tempDir("loom-ws-");
    const checkoutDir = join(tmp.path, "checkout");
    mkdirSync(join(checkoutDir, "src"), { recursive: true });
    writeFileSync(join(checkoutDir, "src/server.ts"), 'app.get("/health", handler);\n');
    run = await createRunWorkspace({
      runId: "test-run",
      checkoutDir,
      skillsDir,
      scratchRoot: join(tmp.path, "scratch"),
    });
  });
  afterAll(async () => {
    await run?.dispose();
    tmp.cleanup();
  });

  it("discovers every runtime skill", async () => {
    const names = (await run.workspace.skills?.list())?.map((s) => s.name).sort();
    expect(names).toEqual([...analysisIds, "module-digest"].sort());
  });

  it("mounts the repo read-only", async () => {
    const fs = run.workspace.filesystem;
    expect(String(await fs?.readFile("/repo/src/server.ts"))).toContain("/health");
    await expect(fs?.writeFile("/repo/evil.ts", "x")).rejects.toThrow();
    await expect(fs?.writeFile("/skills/evil.md", "x")).rejects.toThrow();
  });

  it("runs skill scripts inside the sandbox when isolation is available", async ({ skip }) => {
    if (!run.commandsEnabled) skip("当前机器没有 seatbelt / bwrap");
    const result = await run.workspace.sandbox?.executeCommand?.("node", [
      "skills/api-surface/scripts/find-routes.mjs",
      "repo",
    ]);
    expect(result?.exitCode).toBe(0);
    expect(result?.stdout).toContain("/health");
  });
});
