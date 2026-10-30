import {
  type AnalysisId,
  type AnalyzeInput,
  type AnalyzeOutput,
  analysisDefinitions,
  analysisIds,
  analyzeInputSchema,
  analyzeOutputSchema,
  type RunLogEntry,
  type RunStatus,
  runLogEntrySchema,
  stepGroupOf,
  type WorkflowStepId,
  workflowStepIds,
} from "@loom/contracts";

export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped";

/** 一个原始工作流步骤的状态；status 是 Mastra 步骤状态（running / success / failed / bailed …）。 */
export type StepRecord = { status: string; startedAt?: number; endedAt?: number; error?: string };

export type RunState = {
  phase: "connecting" | RunStatus;
  steps: Record<string, StepRecord>;
  /** 分析步骤“成功返回但带错误”的软失败 */
  analysisErrors: Partial<Record<AnalysisId, string>>;
  /** 按时间排序、按 id 去重的运行日志 */
  logs: RunLogEntry[];
  input: AnalyzeInput | null;
  result: AnalyzeOutput | null;
  error: string | null;
};

/** 工作流流式事件里本模块关心的部分。 */
export type RunEvent = { type: string; payload?: unknown };

/** `workflow.runById` 返回的快照里本模块关心的部分。 */
export type RunSnapshot = {
  status: string;
  payload?: unknown;
  steps?: Record<
    string,
    { status?: string; output?: unknown; startedAt?: number; endedAt?: number; error?: unknown }
  >;
  result?: unknown;
  error?: unknown;
};

export type RunAction =
  | { type: "event"; event: RunEvent }
  | { type: "snapshot"; snapshot: RunSnapshot }
  | { type: "logs"; entries: RunLogEntry[] }
  | { type: "failed"; message: string };

export const initialRunState: RunState = {
  phase: "connecting",
  steps: {},
  analysisErrors: {},
  logs: [],
  input: null,
  result: null,
  error: null,
};

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

export function toRunStatus(raw: string | undefined): RunStatus {
  return STATUS_MAP[raw ?? ""] ?? "running";
}

export function isTerminal(phase: RunState["phase"]): boolean {
  return phase === "success" || phase === "failed" || phase === "canceled";
}

type StepPayload = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
  startedAt?: number;
  endedAt?: number;
  workflowStatus?: string;
};

const isAnalysisId = (id: string): id is AnalysisId => (analysisIds as readonly string[]).includes(id);

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error && typeof error.message === "string")
    return error.message;
  return JSON.stringify(error);
}

const timestamp = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function mergeStep(state: RunState, id: string, patch: StepRecord): RunState {
  const prev = state.steps[id];
  const merged: StepRecord = {
    status: patch.status,
    startedAt: patch.startedAt ?? prev?.startedAt,
    endedAt: patch.endedAt ?? prev?.endedAt,
    error: patch.error ?? prev?.error,
  };
  return { ...state, steps: { ...state.steps, [id]: merged } };
}

/** 读入一个步骤的结果：记录状态与耗时、分析软失败，以及工作流的最终输出。 */
function applyStepResult(state: RunState, id: string, payload: StepPayload): RunState {
  const { output } = payload;
  const next = mergeStep(state, id, {
    status: payload.status ?? "success",
    startedAt: timestamp(payload.startedAt),
    endedAt: timestamp(payload.endedAt),
    error: errorMessage(payload.error) ?? undefined,
  });
  if (isAnalysisId(id) && output && typeof output === "object" && "error" in output) {
    const message = errorMessage(output.error);
    if (message) next.analysisErrors = { ...state.analysisErrors, [id]: message };
  }
  if (next.steps[id]?.status === "bailed" || (id === "render" && next.steps[id]?.status === "success")) {
    const parsed = analyzeOutputSchema.safeParse(output);
    if (parsed.success) next.result = parsed.data;
  }
  return next;
}

export function mergeLogs(current: RunLogEntry[], incoming: RunLogEntry[]): RunLogEntry[] {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((e) => e.id));
  const fresh = incoming.filter((e) => !seen.has(e.id) && seen.add(e.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => a.at - b.at);
}

/** `workflow-step-output` 的载荷在嵌套工作流、foreach 中会多包几层，这里逐层找日志条目。 */
export function findLogEntry(value: unknown, depth = 0): RunLogEntry | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const parsed = runLogEntrySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const record = value as Record<string, unknown>;
  return findLogEntry(record.output, depth + 1) ?? findLogEntry(record.payload, depth + 1);
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "failed":
      return { ...state, phase: "failed", error: action.message };
    case "logs":
      return { ...state, logs: mergeLogs(state.logs, action.entries) };
    case "snapshot": {
      const { snapshot } = action;
      let next: RunState = {
        ...state,
        phase: toRunStatus(snapshot.status),
        error: errorMessage(snapshot.error),
      };
      for (const [id, step] of Object.entries(snapshot.steps ?? {})) {
        next = applyStepResult(next, id, { ...step, status: step.status ?? "pending" });
      }
      const result = analyzeOutputSchema.safeParse(snapshot.result);
      if (result.success) next.result = result.data;
      const input = analyzeInputSchema.safeParse(snapshot.payload);
      if (input.success) next.input = input.data;
      return next;
    }
    case "event": {
      const payload = (action.event.payload ?? {}) as StepPayload;
      switch (action.event.type) {
        case "workflow-start":
          return state.phase === "connecting" || state.phase === "pending"
            ? { ...state, phase: "running" }
            : state;
        case "workflow-step-start":
          return payload.id
            ? mergeStep(state, payload.id, { status: "running", startedAt: timestamp(payload.startedAt) })
            : state;
        case "workflow-step-result":
          return payload.id ? applyStepResult(state, payload.id, payload) : state;
        case "workflow-step-output": {
          const entry = findLogEntry(payload);
          return entry ? { ...state, logs: mergeLogs(state.logs, [entry]) } : state;
        }
        case "workflow-finish":
          return { ...state, phase: toRunStatus(payload.workflowStatus) };
        case "workflow-canceled":
          return { ...state, phase: "canceled" };
        case "workflow-paused":
          return { ...state, phase: "suspended" };
        default:
          return state;
      }
    }
  }
}

type Timing = { startedAt: number | null; endedAt: number | null };
export type TimelineChild = Timing & { id: AnalysisId; status: StepStatus; error: string | null };
export type TimelineItem = Timing & {
  id: WorkflowStepId;
  status: StepStatus;
  error: string | null;
  children: TimelineChild[];
};

function normalize(raw: string | undefined): StepStatus {
  switch (raw) {
    case undefined:
    case "pending":
      return "pending";
    case "success":
    case "bailed":
      return "success";
    case "failed":
    case "tripwire":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "running";
  }
}

function combine(statuses: StepStatus[]): StepStatus {
  if (statuses.length === 0) return "pending";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("running")) return "running";
  if (statuses.every((s) => s === "skipped")) return "skipped";
  return "success";
}

function timing(records: StepRecord[], finished: boolean): Timing {
  const starts = records.map((r) => r.startedAt).filter((t) => t !== undefined);
  const ends = records.map((r) => r.endedAt).filter((t) => t !== undefined);
  return {
    startedAt: starts.length > 0 ? Math.min(...starts) : null,
    endedAt: finished && ends.length > 0 ? Math.max(...ends) : null,
  };
}

/** 把原始步骤状态归并成时间线上的六个阶段；分析与顾问阶段带子项。 */
export function deriveTimeline(state: RunState): TimelineItem[] {
  const grouped = new Map<WorkflowStepId, { statuses: StepStatus[]; records: StepRecord[] }>();
  for (const [id, record] of Object.entries(state.steps)) {
    const group = stepGroupOf(id);
    // 汇总步骤在跳过摘要时也会成功，计入会让“模块摘要”显示为完成。
    if (!group || id === "collect-digests") continue;
    const raw = normalize(record.status);
    const status = id === "skip-digest" && raw === "success" ? "skipped" : raw;
    const entry = grouped.get(group) ?? { statuses: [], records: [] };
    entry.statuses.push(status);
    entry.records.push(record);
    grouped.set(group, entry);
  }

  const cached = state.result?.cached === true;
  const settle = (status: StepStatus): StepStatus => {
    if (status === "pending" && (cached || state.phase === "success")) return "skipped";
    if (status === "running" && state.phase === "canceled") return "skipped";
    if (status === "running" && state.phase === "failed") return "failed";
    return status;
  };
  const finished = (status: StepStatus) => status === "success" || status === "failed";

  return workflowStepIds.map((id) => {
    const childPhase = id === "analyses" ? "analyze" : id === "advisor" ? "advise" : null;
    const children: TimelineChild[] = childPhase
      ? analysisIds
          .filter((a) => analysisDefinitions[a].phase === childPhase)
          .map((a) => {
            const record = state.steps[a];
            const error = state.analysisErrors[a] ?? record?.error ?? null;
            const settled = settle(normalize(record?.status));
            const status = error && settled === "success" ? "failed" : settled;
            return { id: a, status, error, ...timing(record ? [record] : [], finished(status)) };
          })
      : [];
    const group = grouped.get(id);
    const status = settle(combine(group?.statuses ?? []));
    const error = group?.records.find((r) => r.error)?.error ?? null;
    return { id, status, error, children, ...timing(group?.records ?? [], finished(status)) };
  });
}

export type RunOutcome =
  | { kind: "connecting" }
  | { kind: "running"; current: WorkflowStepId | null; done: number; total: number }
  | { kind: "suspended" }
  | { kind: "canceled" }
  | { kind: "cached" }
  | { kind: "success"; analyses: number }
  | { kind: "partial"; failed: AnalysisId[]; analyses: number }
  | { kind: "failed"; step: WorkflowStepId | null; message: string | null };

/** 运行的结论：进行到哪一步、整体成功、部分分析失败还是整体失败。 */
export function deriveOutcome(state: RunState, timeline: TimelineItem[]): RunOutcome {
  switch (state.phase) {
    case "connecting":
      return { kind: "connecting" };
    case "pending":
    case "running":
      return {
        kind: "running",
        current: timeline.find((item) => item.status === "running")?.id ?? null,
        done: timeline.filter((item) => item.status === "success" || item.status === "skipped").length,
        total: timeline.length,
      };
    case "suspended":
      return { kind: "suspended" };
    case "canceled":
      return { kind: "canceled" };
    case "failed": {
      const failed = timeline.find((item) => item.status === "failed");
      return {
        kind: "failed",
        step: failed?.id ?? null,
        message: state.error ?? failed?.error ?? failed?.children.find((c) => c.error)?.error ?? null,
      };
    }
    case "success": {
      if (state.result?.cached) return { kind: "cached" };
      const children = timeline.flatMap((item) => item.children);
      const failed = children.filter((c) => c.status === "failed").map((c) => c.id);
      return failed.length > 0
        ? { kind: "partial", failed, analyses: children.length }
        : { kind: "success", analyses: children.length };
    }
  }
}

/** 整次运行的起止时间，取各步骤时间的最早与最晚值。 */
export function runTiming(state: RunState): Timing {
  return timing(Object.values(state.steps), isTerminal(state.phase));
}
