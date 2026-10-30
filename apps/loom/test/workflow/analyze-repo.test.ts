import { join } from "node:path";
import {
  ANALYZE_WORKFLOW_ID,
  type AnalyzeOutput,
  analysisIds,
  type Report,
  type RunLogEntry,
} from "@loom/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSourceRepo, type SourceRepo, tempDir } from "../helpers/git-fixture";

const failing = vi.hoisted(() => ({ agentIds: new Set<string>() }));

vi.mock("../../src/analyses/shared/run-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/analyses/shared/run-agent")>();
  const { LoomError } = await import("../../src/domain/index");
  return {
    ...actual,
    runAnalysisAgent: (input: Parameters<typeof actual.runAnalysisAgent>[0]) => {
      if (failing.agentIds.has(input.agent.id)) {
        throw new LoomError("AGENT_FAILED", `Agent ${input.agent.id} 调用失败：注入的故障`);
      }
      return actual.runAnalysisAgent(input);
    },
  };
});

type Runtime = {
  mastra: typeof import("../../src/mastra/index").mastra;
  store: ReturnType<typeof import("../../src/mastra/runtime").getRunStore>;
  resetConfig: () => void;
};

describe("analyze-repo workflow (fake mode)", () => {
  let tmp: ReturnType<typeof tempDir>;
  let source: SourceRepo;
  let runtime: Runtime;

  beforeAll(async () => {
    tmp = tempDir("loom-wf-");
    source = createSourceRepo(join(tmp.path, "source"), {
      "package.json": '{ "name": "demo" }\n',
      "src/index.ts": "export const a = 1;\n",
      "src/util.ts": "export const b = 2;\n",
      "lib/extra.ts": "export const c = 3;\n",
    });
    vi.stubEnv("LOOM_AGENT_MODE", "fake");
    vi.stubEnv("LOOM_ALLOW_LOCAL_REPOS", "true");
    vi.stubEnv("LOOM_DATA_DIR", join(tmp.path, "data"));
    vi.stubEnv("LOOM_SPLIT_FILE_THRESHOLD", "400");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("LOOM_FAKE_DELAY_MS", "0");
    vi.stubEnv("LOOM_LOG_LEVEL", "warn");

    const config = await import("../../src/config/index");
    config.resetConfigForTests();
    const { mastra } = await import("../../src/mastra/index");
    const { getRunStore } = await import("../../src/mastra/runtime");
    runtime = { mastra, store: getRunStore(), resetConfig: config.resetConfigForTests };
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    tmp.cleanup();
  });

  beforeEach(() => {
    failing.agentIds.clear();
    vi.stubEnv("LOOM_SPLIT_FILE_THRESHOLD", "400");
    runtime.resetConfig();
  });

  async function analyze(
    force: boolean,
  ): Promise<{ output: AnalyzeOutput; report: Report; steps: string[]; logs: RunLogEntry[] }> {
    const run = await runtime.mastra.getWorkflow(ANALYZE_WORKFLOW_ID).createRun();
    const result = await run.start({ inputData: { repoUrl: source.url, force } });
    if (result.status !== "success") throw new Error(`run ${result.status}: ${JSON.stringify(result)}`);
    return {
      output: result.result,
      report: await runtime.store.readReport(result.result.runId),
      steps: Object.keys(result.steps),
      logs: await runtime.store.readLogs(result.result.runId),
    };
  }

  const logLine = (logs: RunLogEntry[], step: string, text: string, level = "info") =>
    logs.find((e) => e.step === step && e.level === level && e.message.includes(text));

  it("analyzes a small repo without module digests", async () => {
    const { output, report, steps, logs } = await analyze(true);
    expect(output.cached).toBe(false);
    expect(logLine(logs, "sync-repo", "检出提交")).toBeDefined();
    expect(logLine(logs, "sync-repo", "假模式（LOOM_AGENT_MODE=fake）", "warn")).toBeDefined();
    expect(
      logLine(logs, "sync-repo", `运行目录 ${join(tmp.path, "data", "runs", output.runId)}`),
    ).toBeDefined();
    expect(logLine(logs, "sync-repo", `仓库镜像 ${join(tmp.path, "data", "repos")}`)).toBeDefined();
    expect(logLine(logs, "render", `报告已写入 ${output.reportPath}`)).toBeDefined();
    expect(logLine(logs, "render", `写入缓存（${join(tmp.path, "data", "cache")}`)).toBeDefined();
    expect(logLine(logs, "scout-repo", "跳过模块摘要")).toBeDefined();
    expect(logLine(logs, "api-surface", "完成")).toBeDefined();
    expect(logLine(logs, "render", "报告已生成并写入缓存")).toBeDefined();
    expect(logs.map((e) => e.at)).toEqual([...logs.map((e) => e.at)].sort((a, b) => a - b));
    expect(steps).toContain("skip-digest");
    expect(steps).not.toContain("digest-modules");
    expect(report.mode).toBe("fake");
    expect(report.repo.sha).toBe(source.head());
    expect(report.digests).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(Object.keys(report.artifacts).sort()).toEqual([...analysisIds].sort());
  });

  it("returns the cached report for the same commit and skills", async () => {
    const first = await analyze(true);
    const second = await analyze(false);
    expect(second.output.cached).toBe(true);
    expect(second.output.runId).not.toBe(first.output.runId);
    expect(
      logLine(second.logs, "sync-repo", `命中缓存：同一提交与技能版本已在运行 ${first.output.runId}`),
    ).toBeDefined();
    expect(second.report.artifacts).toEqual(first.report.artifacts);
  });

  it("re-runs after a new commit even without force", async () => {
    await analyze(true);
    source.commit({ "src/later.ts": "export {};\n" });
    const { output, report } = await analyze(false);
    expect(output.cached).toBe(false);
    expect(report.repo.sha).toBe(source.head());
  });

  it("digests modules first when the repo is large", async () => {
    vi.stubEnv("LOOM_SPLIT_FILE_THRESHOLD", "1");
    runtime.resetConfig();
    const { report, steps } = await analyze(true);
    expect(steps).toContain("digest-modules");
    expect(report.scout.large).toBe(true);
    expect(report.digests.map((d) => d.module).sort()).toEqual(
      report.scout.topLevelDirs.map((d) => d.name).sort(),
    );
    expect(report.digests.length).toBeGreaterThan(0);
  });

  it("keeps going when one analysis fails and records the error", async () => {
    failing.agentIds.add("data-model-agent");
    const { report, logs } = await analyze(true);
    expect(logLine(logs, "data-model", "失败（AGENT_FAILED）", "error")).toBeDefined();
    expect(logLine(logs, "collect-analyses", "2/3 项成功", "warn")).toBeDefined();
    expect(logLine(logs, "render", "含 1 个步骤错误", "warn")).toBeDefined();
    expect(report.artifacts["data-model"]).toBeUndefined();
    expect(report.artifacts["api-surface"]).toBeDefined();
    expect(report.artifacts["tech-choice"]).toBeDefined();
    expect(report.errors).toEqual([expect.objectContaining({ step: "data-model", code: "AGENT_FAILED" })]);
  });

  it("does not cache a report that has errors", async () => {
    source.commit({ "src/fresh.ts": "export {};\n" });
    failing.agentIds.add("tech-choice-agent");
    const failed = await analyze(false);
    expect(failed.output.cached).toBe(false);
    expect(failed.report.errors).toHaveLength(1);
    failing.agentIds.clear();
    const { output, report } = await analyze(false);
    expect(output.cached).toBe(false);
    expect(report.errors).toEqual([]);
  });
});
