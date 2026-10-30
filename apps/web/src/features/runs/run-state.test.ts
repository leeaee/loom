import { RUN_LOG_EVENT, type RunLogEntry, workflowStepIds } from "@loom/contracts";
import { describe, expect, it } from "vitest";
import {
  deriveOutcome,
  deriveTimeline,
  findLogEntry,
  initialRunState,
  isTerminal,
  mergeLogs,
  type RunEvent,
  type RunState,
  runReducer,
  runTiming,
  type TimelineItem,
} from "./run-state";

const output = { runId: "run-1", cached: false, reportPath: "/data/runs/run-1/report.json" };

function play(events: RunEvent[], from: RunState = initialRunState): RunState {
  return events.reduce((state, event) => runReducer(state, { type: "event", event }), from);
}

const start = (id: string): RunEvent => ({ type: "workflow-step-start", payload: { id } });
const done = (id: string, out: unknown = {}, status = "success"): RunEvent => ({
  type: "workflow-step-result",
  payload: { id, status, output: out },
});

function statusOf(timeline: TimelineItem[]) {
  return Object.fromEntries(timeline.map((item) => [item.id, item.status]));
}

describe("runReducer + deriveTimeline", () => {
  it("tracks a normal small-repo run to success", () => {
    const state = play([
      { type: "workflow-start" },
      start("sync-repo"),
      done("sync-repo"),
      start("scout-repo"),
      done("scout-repo"),
      start("skip-digest"),
      done("skip-digest"),
      done("collect-digests"),
      done("api-surface", { id: "api-surface", artifact: {}, error: null }),
      done("data-model", { id: "data-model", artifact: {}, error: null }),
      done("architecture-flow", { id: "architecture-flow", artifact: {}, error: null }),
      done("collect-analyses"),
      done("tech-choice", { id: "tech-choice", artifact: {}, error: null }),
      done("render", output),
      { type: "workflow-finish", payload: { workflowStatus: "success" } },
    ]);

    expect(state.phase).toBe("success");
    expect(isTerminal(state.phase)).toBe(true);
    expect(state.result).toEqual(output);
    const timeline = deriveTimeline(state);
    expect(timeline.map((item) => item.id)).toEqual([...workflowStepIds]);
    expect(statusOf(timeline)).toMatchObject({
      "sync-repo": "success",
      "scout-repo": "success",
      digest: "success",
      analyses: "success",
      advisor: "success",
      render: "success",
    });
  });

  it("shows running steps while the run is in flight", () => {
    const state = play([{ type: "workflow-start" }, done("sync-repo"), start("scout-repo")]);
    expect(isTerminal(state.phase)).toBe(false);
    expect(statusOf(deriveTimeline(state))).toMatchObject({
      "sync-repo": "success",
      "scout-repo": "running",
      digest: "pending",
    });
  });

  it("treats a bailed sync step as a cache hit and skips the rest", () => {
    const cachedOutput = { ...output, cached: true };
    const state = play([
      { type: "workflow-start" },
      start("sync-repo"),
      done("sync-repo", cachedOutput, "bailed"),
      { type: "workflow-finish", payload: { workflowStatus: "success" } },
    ]);
    expect(state.result).toEqual(cachedOutput);
    const timeline = deriveTimeline(state);
    expect(statusOf(timeline)).toMatchObject({
      "sync-repo": "success",
      digest: "skipped",
      render: "skipped",
    });
    expect(
      timeline.find((item) => item.id === "analyses")?.children.every((c) => c.status === "skipped"),
    ).toBe(true);
  });

  it("marks an analysis that returned an error as failed without failing the run", () => {
    const state = play([
      done("data-model", { id: "data-model", artifact: null, error: { message: "模型超时" } }),
      done("api-surface", { id: "api-surface", artifact: {}, error: null }),
    ]);
    expect(state.analysisErrors).toEqual({ "data-model": "模型超时" });
    const analyses = deriveTimeline(state).find((item) => item.id === "analyses");
    expect(analyses?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "data-model", status: "failed", error: "模型超时" }),
        expect.objectContaining({ id: "api-surface", status: "success", error: null }),
      ]),
    );
  });

  it("groups nested digest steps under the digest stage", () => {
    const state = play([start("digest-modules.plan-digests"), start("digest-modules")]);
    expect(statusOf(deriveTimeline(state)).digest).toBe("running");
  });

  it("settles running steps when the run fails or is canceled", () => {
    const running = play([{ type: "workflow-start" }, start("sync-repo")]);
    const failed = runReducer(running, { type: "failed", message: "连接断开" });
    expect(failed.error).toBe("连接断开");
    expect(statusOf(deriveTimeline(failed))["sync-repo"]).toBe("failed");

    const canceled = play([{ type: "workflow-canceled" }], running);
    expect(canceled.phase).toBe("canceled");
    expect(statusOf(deriveTimeline(canceled))["sync-repo"]).toBe("skipped");
  });

  it("restores state from a run snapshot", () => {
    const state = runReducer(initialRunState, {
      type: "snapshot",
      snapshot: {
        status: "success",
        payload: { repoUrl: "https://github.com/vercel/ms", force: false },
        steps: {
          "sync-repo": { status: "success" },
          "skip-digest": { status: "success" },
          "tech-choice": {
            status: "success",
            output: { id: "tech-choice", artifact: null, error: "缺少输入" },
          },
        },
        result: output,
      },
    });
    expect(state.phase).toBe("success");
    expect(state.input?.repoUrl).toBe("https://github.com/vercel/ms");
    expect(state.result).toEqual(output);
    expect(state.analysisErrors["tech-choice"]).toBe("缺少输入");
    expect(statusOf(deriveTimeline(state)).digest).toBe("skipped");
  });

  it("records step timing and errors from events and snapshots", () => {
    const state = play([
      { type: "workflow-step-start", payload: { id: "sync-repo", startedAt: 1000 } },
      { type: "workflow-step-result", payload: { id: "sync-repo", status: "success", endedAt: 3500 } },
      { type: "workflow-step-start", payload: { id: "scout-repo", startedAt: 3600 } },
    ]);
    const timeline = deriveTimeline(state);
    expect(timeline[0]).toMatchObject({ id: "sync-repo", startedAt: 1000, endedAt: 3500 });
    expect(timeline[1]).toMatchObject({ id: "scout-repo", startedAt: 3600, endedAt: null });
    expect(runTiming(state)).toEqual({ startedAt: 1000, endedAt: null });

    const failed = runReducer(state, {
      type: "snapshot",
      snapshot: {
        status: "failed",
        error: { message: "仓库不存在" },
        steps: { "scout-repo": { status: "failed", error: { message: "仓库不存在" }, endedAt: 4000 } },
      },
    });
    expect(deriveTimeline(failed)[1]).toMatchObject({ status: "failed", error: "仓库不存在", endedAt: 4000 });
    expect(runTiming(failed)).toEqual({ startedAt: 1000, endedAt: 4000 });
  });
});

const entry = (id: string, at: number, step = "sync-repo"): RunLogEntry => ({
  type: RUN_LOG_EVENT,
  id,
  at,
  step,
  level: "info",
  message: `log ${id}`,
});

describe("run logs", () => {
  it("collects log entries from step-output events, including nested payloads", () => {
    const state = play([
      { type: "workflow-step-output", payload: { output: entry("a", 2) } },
      {
        type: "workflow-step-output",
        payload: { output: { type: "x", payload: { output: entry("b", 1) } } },
      },
      { type: "workflow-step-output", payload: { output: { unrelated: true } } },
    ]);
    expect(state.logs.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("dedupes replayed and restored entries by id", () => {
    const fromEvents = play([
      { type: "workflow-step-output", payload: { output: entry("a", 1) } },
      { type: "workflow-step-output", payload: { output: entry("a", 1) } },
    ]);
    const restored = runReducer(fromEvents, { type: "logs", entries: [entry("a", 1), entry("c", 3)] });
    expect(restored.logs.map((e) => e.id)).toEqual(["a", "c"]);
    expect(mergeLogs(restored.logs, [])).toBe(restored.logs);
  });

  it("ignores values that are not log entries", () => {
    expect(findLogEntry(null)).toBeNull();
    expect(findLogEntry({ output: { message: "缺少字段" } })).toBeNull();
  });
});

describe("deriveOutcome", () => {
  const outcomeOf = (state: RunState) => deriveOutcome(state, deriveTimeline(state));
  const analysisDone = (id: string, error: unknown = null) => done(id, { id, artifact: {}, error });
  const finish = { type: "workflow-finish", payload: { workflowStatus: "success" } };

  it("reports the current stage while running", () => {
    expect(outcomeOf(play([{ type: "workflow-start" }, done("sync-repo"), start("scout-repo")]))).toEqual({
      kind: "running",
      current: "scout-repo",
      done: 1,
      total: workflowStepIds.length,
    });
  });

  it("distinguishes full success, partial failure and cache hits", () => {
    const analyses = ["api-surface", "data-model", "architecture-flow", "tech-choice"];
    const ok = play([...analyses.map((id) => analysisDone(id)), done("render", output), finish]);
    expect(outcomeOf(ok)).toEqual({ kind: "success", analyses: 4 });

    const partial = play([
      ...analyses.map((id) => analysisDone(id, id === "data-model" ? "模型超时" : null)),
      done("render", output),
      finish,
    ]);
    expect(outcomeOf(partial)).toEqual({ kind: "partial", failed: ["data-model"], analyses: 4 });

    const cached = play([done("sync-repo", { ...output, cached: true }, "bailed"), finish]);
    expect(outcomeOf(cached)).toEqual({ kind: "cached" });
  });

  it("names the failed stage and its message", () => {
    const state = play([
      { type: "workflow-start" },
      done("sync-repo", undefined, "failed"),
      { type: "workflow-finish", payload: { workflowStatus: "failed" } },
    ]);
    const failed = runReducer(state, { type: "snapshot", snapshot: { status: "failed", error: "克隆失败" } });
    expect(outcomeOf(failed)).toEqual({ kind: "failed", step: "sync-repo", message: "克隆失败" });
  });
});
