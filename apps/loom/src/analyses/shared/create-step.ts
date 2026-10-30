import { type AnalysisId, type ArtifactOf, analysisDefinitions } from "@loom/contracts";
import { fixtureArtifacts } from "@loom/contracts/fixtures";
import type { Agent } from "@mastra/core/agent";
import type { Mastra } from "@mastra/core/mastra";
import { createStep } from "@mastra/core/workflows";
import type { ZodType } from "zod";
import { toStepError } from "../../domain/index";
import { createRunLogger, type StepWriter } from "../../infra/index";
import {
  type AdviseInput,
  type AnalysisInput,
  type AnalysisResult,
  adviseInputSchema,
  analysisInputSchema,
  analysisResultSchema,
} from "../types";
import { runAnalysisAgent } from "./run-agent";

type StepOptions<Id extends AnalysisId, I> = {
  id: Id;
  description: string;
  agent: Agent;
  /** 根据步骤输入构造给 Agent 的任务说明 */
  buildPrompt: (input: I) => string;
};

function makeExecute<Id extends AnalysisId, I extends AnalysisInput>(options: StepOptions<Id, I>) {
  const schema = analysisDefinitions[options.id].artifact as unknown as ZodType<ArtifactOf<Id>>;
  return async ({
    inputData,
    mastra,
    writer,
    abortSignal,
  }: {
    inputData: I;
    mastra?: Mastra;
    writer?: StepWriter;
    abortSignal?: AbortSignal;
  }): Promise<AnalysisResult> => {
    const log = createRunLogger({
      runId: inputData.ctx.runId,
      step: options.id,
      writer,
      logger: mastra?.getLogger(),
    });
    const startedAt = Date.now();
    await log.info(`开始：${options.description}`);
    try {
      const artifact = await runAnalysisAgent({
        mastra,
        agent: options.agent,
        ctx: inputData.ctx,
        prompt: options.buildPrompt(inputData),
        schema,
        fixture: () => fixtureArtifacts[options.id],
        log,
        ...(abortSignal ? { abortSignal } : {}),
      });
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      await log.info(`完成（${seconds} 秒）：${artifact.summary.slice(0, 120)}`);
      return { id: options.id, artifact, error: null };
    } catch (error) {
      if (abortSignal?.aborted) {
        await log.warn("已取消");
        throw error;
      }
      const stepError = toStepError(options.id, error);
      await log.error(`失败（${stepError.code}）：${stepError.message}`);
      return { id: options.id, artifact: null, error: stepError };
    }
  };
}

/** analyze 阶段的步骤：输入运行上下文与模块摘要，并行执行。 */
export function createAnalyzeStep<Id extends AnalysisId>(options: StepOptions<Id, AnalysisInput>) {
  return createStep({
    id: options.id,
    description: options.description,
    inputSchema: analysisInputSchema,
    outputSchema: analysisResultSchema,
    execute: makeExecute(options),
  });
}

/** advise 阶段的步骤：在全部 analyze 产物之上给出建议。 */
export function createAdviseStep<Id extends AnalysisId>(options: StepOptions<Id, AdviseInput>) {
  return createStep({
    id: options.id,
    description: options.description,
    inputSchema: adviseInputSchema,
    outputSchema: analysisResultSchema,
    execute: makeExecute(options),
  });
}

export type AnalyzeStep = ReturnType<typeof createAnalyzeStep>;
export type AdviseStep = ReturnType<typeof createAdviseStep>;
