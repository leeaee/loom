import { z } from "zod";
import { analysisDefinitions, analysisIdSchema } from "./analyses/index";

export const ANALYZE_WORKFLOW_ID = "analyzeRepo";

/** analyzeRepo 工作流的输入。 */
export const analyzeInputSchema = z.object({
  repoUrl: z.string().trim().min(1, "请输入 Git 地址"),
  ref: z.string().trim().min(1).optional(),
  force: z.boolean().optional().describe("为 true 时忽略缓存重新分析"),
});
export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;

/** analyzeRepo 工作流的输出。 */
export const analyzeOutputSchema = z.object({
  runId: z.string(),
  cached: z.boolean(),
  reportPath: z.string(),
});
export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>;

/**
 * 工作流中对用户可见的步骤，按执行顺序排列。
 * 前端时间线据此渲染；步骤 id 与 apps/loom 工作流里 createStep 的 id 一致。
 */
export const workflowStepIds = [
  "sync-repo",
  "scout-repo",
  "digest",
  "analyses",
  "advisor",
  "render",
] as const;
export const workflowStepIdSchema = z.enum(workflowStepIds);
export type WorkflowStepId = z.infer<typeof workflowStepIdSchema>;

const digestStepIds = new Set([
  "digest-modules",
  "skip-digest",
  "collect-digests",
  "plan-digests",
  "module-digest",
  "merge-digests",
]);

/**
 * 把工作流内部步骤 id（含嵌套工作流与分析模块步骤）归入时间线分组。
 * 无法识别时返回 null，调用方忽略即可。
 */
export function stepGroupOf(stepId: string): WorkflowStepId | null {
  const id = stepId.split(".").at(-1) ?? stepId;
  if (id === "sync-repo" || id === "scout-repo" || id === "render") return id;
  if (digestStepIds.has(id) || id.startsWith("digest:")) return "digest";
  if (id === "collect-analyses") return "analyses";
  const parsed = analysisIdSchema.safeParse(id);
  if (parsed.success) return analysisDefinitions[parsed.data].phase === "advise" ? "advisor" : "analyses";
  return null;
}

export const runStatusSchema = z.enum(["pending", "running", "success", "failed", "canceled", "suspended"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

/** GET /loom/runs 的列表项。 */
export const runSummarySchema = z.object({
  runId: z.string(),
  repoUrl: z.string(),
  ref: z.string().nullable(),
  status: runStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  hasReport: z.boolean(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const runListSchema = z.object({ runs: z.array(runSummarySchema) });
export type RunList = z.infer<typeof runListSchema>;

/** 步骤经 workflow writer 推送、同时落盘的运行日志事件类型。 */
export const RUN_LOG_EVENT = "loom-log";

export const runLogLevelSchema = z.enum(["info", "warn", "error"]);
export type RunLogLevel = z.infer<typeof runLogLevelSchema>;

/** 一条运行日志：实时出现在事件流（workflow-step-output），并追加到 runs/<runId>/logs.jsonl。 */
export const runLogEntrySchema = z.object({
  type: z.literal(RUN_LOG_EVENT),
  id: z.string(),
  at: z.number().int().describe("毫秒时间戳"),
  step: z.string().describe("工作流步骤 id，例如 sync-repo、data-model；模块摘要为 digest:<module>"),
  level: runLogLevelSchema,
  message: z.string(),
});
export type RunLogEntry = z.infer<typeof runLogEntrySchema>;

/** GET /loom/runs/:runId/logs */
export const runLogSchema = z.object({ entries: z.array(runLogEntrySchema) });
export type RunLog = z.infer<typeof runLogSchema>;

export const LOOM_API_PREFIX = "/loom";
export const loomRoutes = {
  runs: `${LOOM_API_PREFIX}/runs`,
  report: (runId: string) => `${LOOM_API_PREFIX}/runs/${encodeURIComponent(runId)}/report`,
  reportMarkdown: (runId: string) => `${LOOM_API_PREFIX}/runs/${encodeURIComponent(runId)}/report.md`,
  logs: (runId: string) => `${LOOM_API_PREFIX}/runs/${encodeURIComponent(runId)}/logs`,
} as const;
