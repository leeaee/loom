import { setTimeout as sleep } from "node:timers/promises";
import type { Agent } from "@mastra/core/agent";
import type { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import type { z } from "zod";
import { loadConfig } from "../../config/index";
import { LoomError, parseAgentOutput, redactSecrets } from "../../domain/index";
import { acquireRunResources, REPO_MOUNT, type RunLogger, SKILLS_MOUNT } from "../../infra/index";
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
 * - 真实模式：设最大步数；每次工具调用写一条运行日志；产出先宽松解析（代码块、说明文字、多包一层键），
 *   仍不合格时带着对话历史与校验错误让模型只修正格式一次（禁用工具），再失败抛出 AGENT_OUTPUT_INVALID。
 */
export async function runAnalysisAgent<T>(input: RunAgentInput<T>): Promise<T> {
  const { ctx, log } = input;
  const config = loadConfig();
  if (ctx.mode === "fake") {
    await log?.info(
      "假模式：不调用大模型，返回内置示例数据（与本仓库内容无关）" +
        (config.fakeDelayMs > 0 ? `，模拟耗时 ${config.fakeDelayMs} ms` : ""),
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
  await log?.info(
    `Agent 只读挂载 ${REPO_MOUNT} → ${ctx.checkoutDir}、${SKILLS_MOUNT} → ${config.paths.skillsDir}；` +
      `沙箱可写目录 ${resources.workspace.scratchDir}（运行结束删除）`,
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

  // 校验失败不在框架内抛错，交给 parseAgentOutput 宽松解析，再决定是否修正。
  const structuredOutput = {
    schema: input.schema,
    jsonPromptInjection: "auto" as const,
    errorStrategy: "warn" as const,
  };
  const common = {
    requestContext,
    toolsets: resources.mcp.toolsets,
    onStepFinish,
    structuredOutput,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  };
  const call = async <R>(run: () => Promise<R>): Promise<R> => {
    try {
      return await run();
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      throw new LoomError("AGENT_FAILED", `Agent ${input.agent.id} 调用失败：${errorMessage(error)}`, {
        cause: error,
      });
    }
  };

  const result = await call(() => agent.generate(input.prompt, { ...common, maxSteps: config.maxSteps }));
  let parsed = parseAgentOutput(input.schema, { object: result.object, text: finalText(result) });

  if (!parsed.ok) {
    await log?.warn(
      `输出不符合合同，带着校验错误让模型只修正格式（不再调用工具）：${parsed.error.slice(0, 300)}`,
    );
    const messages = [
      { role: "user", content: input.prompt },
      ...(result.response?.messages ?? []),
      { role: "user", content: repairPrompt(parsed.error) },
    ] as Parameters<Agent["generate"]>[0];
    const repaired = await call(() =>
      agent.generate(messages, { ...common, maxSteps: 1, toolChoice: "none" }),
    );
    parsed = parseAgentOutput(input.schema, { object: repaired.object, text: finalText(repaired) });
  }

  if (!parsed.ok) {
    throw new LoomError(
      "AGENT_OUTPUT_INVALID",
      `Agent ${input.agent.id} 修正后仍不符合合同：${redactSecrets(parsed.error)}`,
    );
  }
  if (parsed.value.unwrappedKey) {
    await log?.info(`模型把结果包在 "${parsed.value.unwrappedKey}" 键下，已自动拆开`);
  }
  await log?.info(`Agent 完成，共 ${modelSteps} 步`);
  return parsed.value.value;
}

type GenerateOutput = { text: string; steps?: { text?: string }[] };

/** 最后一步的文字才是最终回复；最后一步没有文字（例如用完步数）时退回全部文字。 */
function finalText(output: GenerateOutput): string {
  return output.steps?.at(-1)?.text?.trim() || output.text;
}

function repairPrompt(error: string): string {
  return [
    "你上面的最终输出没有通过结构校验。不要再调用工具，直接根据已经读到的内容重新输出完整结果。",
    "只输出一个符合 schema 的 JSON 对象本身：不要用代码块包裹，不要加说明文字，也不要在外面再包一层键。",
    `校验错误：\n${error}`,
  ].join("\n");
}
