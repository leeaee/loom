import { setTimeout as sleep } from "node:timers/promises";
import type { Agent } from "@mastra/core/agent";
import type { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import type { z } from "zod";
import { loadConfig } from "../../config/index";
import { LoomError, redactSecrets } from "../../domain/index";
import { acquireRunResources, type RunLogger } from "../../infra/index";
import type { RunContext } from "../types";
import { RUN_ID_KEY } from "./create-agent";

export type RunAgentInput<T> = {
  mastra: Mastra | undefined;
  agent: Agent;
  ctx: RunContext;
  prompt: string;
  schema: z.ZodType<T>;
  /** 假模式下直接返回的夹具 */
  fixture: () => T;
  log?: RunLogger;
  abortSignal?: AbortSignal;
};

function errorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

const ARG_KEYS = ["path", "file", "filePath", "pattern", "query", "command", "name", "symbol", "skill"];

/** 工具参数的一句话摘要：优先展示路径、模式、命令等关键字段。 */
export function summarizeToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  const parts = ARG_KEYS.filter(
    (key) => typeof record[key] === "string" || typeof record[key] === "number",
  ).map((key) => `${key}=${String(record[key])}`);
  const text = parts.length > 0 ? parts.join(" ") : JSON.stringify(args);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

type StepEvent = {
  toolCalls?: { payload?: { toolName?: string; args?: unknown } }[];
  usage?: { totalTokens?: number };
};

/**
 * 调用一个分析 Agent 并返回经 Zod 校验的结构化产物。
 * - 假模式：不调用模型，返回夹具（可用 LOOM_FAKE_DELAY_MS 模拟耗时）。
 * - 真实模式：设最大步数；每次工具调用写一条运行日志；校验失败时带着错误信息重试一次，仍失败抛出 AGENT_OUTPUT_INVALID。
 */
export async function runAnalysisAgent<T>(input: RunAgentInput<T>): Promise<T> {
  const { ctx, log } = input;
  const config = loadConfig();
  if (ctx.mode === "fake") {
    await log?.info(
      config.fakeDelayMs > 0 ? `假模式：模拟耗时 ${config.fakeDelayMs} ms 后返回夹具` : "假模式：返回夹具",
    );
    if (config.fakeDelayMs > 0) await sleep(config.fakeDelayMs, undefined, { signal: input.abortSignal });
    return input.schema.parse(input.fixture());
  }

  const resources = await acquireRunResources({
    runId: ctx.runId,
    checkoutDir: ctx.checkoutDir,
    repoHost: ctx.repo.host,
    hasTsconfig: ctx.scout.hasTsconfig,
    skillsDir: config.paths.skillsDir,
    scratchRoot: config.paths.scratchDir,
    githubToken: config.githubToken,
    resolveFrom: [process.cwd(), ...(config.paths.repoRoot ? [config.paths.repoRoot] : [])],
  });
  const mcpServers = Object.keys(resources.mcp.toolsets);
  await log?.info(
    `调用 Agent ${input.agent.id}（模型 ${ctx.model ?? "未设置"}，最多 ${config.maxSteps} 步` +
      `${mcpServers.length ? `，MCP：${mcpServers.join("、")}` : ""}）`,
  );
  for (const [server, message] of Object.entries(resources.mcp.errors)) {
    await log?.warn(`MCP ${server} 不可用：${message}`);
  }

  const agent = (() => {
    try {
      return input.mastra?.getAgentById(input.agent.id) ?? input.agent;
    } catch {
      return input.agent;
    }
  })();
  const requestContext = new RequestContext();
  requestContext.set(RUN_ID_KEY, ctx.runId);

  let modelSteps = 0;
  const onStepFinish = async (event: StepEvent) => {
    modelSteps += 1;
    const calls = event.toolCalls ?? [];
    if (calls.length === 0) {
      await log?.info(`第 ${modelSteps} 步：生成输出`);
      return;
    }
    for (const call of calls) {
      const name = call.payload?.toolName ?? "unknown";
      await log?.info(
        `第 ${modelSteps} 步：调用工具 ${name} ${summarizeToolArgs(call.payload?.args)}`.trim(),
      );
    }
  };

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = lastError
      ? `${input.prompt}\n\n上一次输出未通过结构校验，请修正后重新输出完整结果。校验错误：\n${lastError}`
      : input.prompt;
    try {
      const result = await agent.generate(prompt, {
        maxSteps: config.maxSteps,
        requestContext,
        toolsets: resources.mcp.toolsets,
        onStepFinish,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
        structuredOutput: { schema: input.schema, jsonPromptInjection: "auto" },
      });
      const parsed = input.schema.safeParse(result.object);
      if (parsed.success) {
        await log?.info(`Agent 完成，共 ${modelSteps} 步`);
        return parsed.data;
      }
      lastError = errorMessage(parsed.error);
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      lastError = errorMessage(error);
      if (!/schema|validat|parse|json/i.test(lastError)) {
        throw new LoomError("AGENT_FAILED", `Agent ${input.agent.id} 调用失败：${lastError}`, {
          cause: error,
        });
      }
    }
    if (attempt === 0) await log?.warn(`输出未通过结构校验，带着错误重试一次：${lastError.slice(0, 300)}`);
  }
  throw new LoomError("AGENT_OUTPUT_INVALID", `Agent ${input.agent.id} 两次输出都不符合合同：${lastError}`);
}
