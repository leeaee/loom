import {
  ANALYZE_WORKFLOW_ID,
  analyzeInputSchema,
  LOOM_API_PREFIX,
  type RunStatus,
  type RunSummary,
  runListSchema,
  runLogSchema,
} from "@loom/contracts";
import { registerApiRoute } from "@mastra/core/server";
import { LoomError } from "../../domain/index";
import { getRunStore } from "../runtime";

const STATUS_MAP: Record<string, RunStatus> = {
  pending: "pending",
  running: "running",
  waiting: "running",
  success: "success",
  bailed: "success",
  failed: "failed",
  tripwire: "failed",
  canceled: "canceled",
  suspended: "suspended",
  paused: "suspended",
};

type StoredRun = { runId: string; snapshot: unknown; createdAt: Date; updatedAt: Date };

function toSummary(run: StoredRun): RunSummary | null {
  const snapshot =
    typeof run.snapshot === "string" ? (JSON.parse(run.snapshot) as Record<string, unknown>) : run.snapshot;
  const state = (snapshot ?? {}) as { status?: string; context?: { input?: unknown } };
  const input = analyzeInputSchema.safeParse(state.context?.input);
  if (!input.success) return null;
  return {
    runId: run.runId,
    repoUrl: input.data.repoUrl,
    ref: input.data.ref ?? null,
    status: STATUS_MAP[state.status ?? ""] ?? "pending",
    createdAt: new Date(run.createdAt).toISOString(),
    updatedAt: run.updatedAt ? new Date(run.updatedAt).toISOString() : null,
    hasReport: getRunStore().hasReport(run.runId),
  };
}

async function reportOr404<T>(read: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    if (error instanceof LoomError && error.code === "REPORT_NOT_FOUND") return { ok: false };
    throw error;
  }
}

/** Loom 自有的只读接口；运行的创建、观察与取消使用 Mastra 原生工作流接口。 */
export const loomApiRoutes = [
  registerApiRoute(`${LOOM_API_PREFIX}/runs`, {
    method: "GET",
    handler: async (c) => {
      const mastra = c.get("mastra");
      const { runs } = await mastra
        .getWorkflow(ANALYZE_WORKFLOW_ID)
        .listWorkflowRuns({ perPage: 20, page: 0 });
      const summaries = runs
        .map((run) => toSummary(run))
        .filter((s): s is RunSummary => s !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return c.json(runListSchema.parse({ runs: summaries }));
    },
  }),
  registerApiRoute(`${LOOM_API_PREFIX}/runs/:runId/report`, {
    method: "GET",
    handler: async (c) => {
      const result = await reportOr404(() => getRunStore().readReport(c.req.param("runId")));
      if (!result.ok) return c.json({ error: "REPORT_NOT_FOUND" }, 404);
      return c.json(result.value);
    },
  }),
  registerApiRoute(`${LOOM_API_PREFIX}/runs/:runId/logs`, {
    method: "GET",
    handler: async (c) => {
      const result = await reportOr404(() => getRunStore().readLogs(c.req.param("runId")));
      if (!result.ok) return c.json({ error: "REPORT_NOT_FOUND" }, 404);
      return c.json(runLogSchema.parse({ entries: result.value }));
    },
  }),
  registerApiRoute(`${LOOM_API_PREFIX}/runs/:runId/report.md`, {
    method: "GET",
    handler: async (c) => {
      const runId = c.req.param("runId");
      const result = await reportOr404(() => getRunStore().readMarkdown(runId));
      if (!result.ok) return c.json({ error: "REPORT_NOT_FOUND" }, 404);
      return c.body(result.value, 200, {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="loom-${runId}.md"`,
      });
    },
  }),
];
