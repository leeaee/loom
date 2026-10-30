import {
  loomRoutes,
  type Report,
  type RunList,
  type RunLogEntry,
  type RuntimeInfo,
  reportSchema,
  runListSchema,
  runLogSchema,
  runtimeInfoSchema,
} from "@loom/contracts";
import type { z } from "zod";
import { MASTRA_PREFIX } from "./mastra";

/** 服务端返回的数据与 contracts 不一致。 */
export class ContractError extends Error {
  constructor(
    readonly what: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(`${what} 与合同不一致`);
    this.name = "ContractError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} 不存在`);
    this.name = "NotFoundError";
  }
}

async function getJson<T>(path: string, schema: z.ZodType<T>, what: string): Promise<T> {
  const response = await fetch(`${MASTRA_PREFIX}${path}`, { cache: "no-store" });
  if (response.status === 404) throw new NotFoundError(what);
  if (!response.ok) throw new Error(`${what}请求失败：HTTP ${response.status}`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new ContractError(what, parsed.error.issues);
  return parsed.data;
}

export function fetchRuntime(): Promise<RuntimeInfo> {
  return getJson(loomRoutes.runtime, runtimeInfoSchema, "运行环境");
}

export function fetchRuns(): Promise<RunList> {
  return getJson(loomRoutes.runs, runListSchema, "运行列表");
}

export function fetchReport(runId: string): Promise<Report> {
  return getJson(loomRoutes.report(runId), reportSchema, "报告");
}

export async function fetchRunLogs(runId: string): Promise<RunLogEntry[]> {
  try {
    return (await getJson(loomRoutes.logs(runId), runLogSchema, "运行日志")).entries;
  } catch (error) {
    if (error instanceof NotFoundError) return [];
    throw error;
  }
}

export function reportMarkdownUrl(runId: string): string {
  return `${MASTRA_PREFIX}${loomRoutes.reportMarkdown(runId)}`;
}
