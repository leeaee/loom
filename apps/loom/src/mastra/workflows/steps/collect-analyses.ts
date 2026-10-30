import { type AnalysisId, type Artifacts, analysisDefinitions, type StepError } from "@loom/contracts";
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  type AdviseInput,
  type AnalysisResult,
  adviseInputSchema,
  analysisResultSchema,
} from "../../../analyses/index";
import { createRunLogger } from "../../../infra/index";
import { collectDigestsStep } from "./digest";

export const analysisResultsSchema = z.record(z.string(), analysisResultSchema);

/** 把并行段的输出（以步骤 id 为键）合并进产物表；产物再用合同校验一次。 */
export function mergeResults(
  results: Record<string, AnalysisResult>,
  base: { artifacts: Artifacts; errors: StepError[] },
): { artifacts: Artifacts; errors: StepError[] } {
  const artifacts: Artifacts = { ...base.artifacts };
  const errors = [...base.errors];
  for (const result of Object.values(results)) {
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    const id = result.id as AnalysisId;
    const parsed = analysisDefinitions[id].artifact.safeParse(result.artifact);
    if (parsed.success) (artifacts as Record<string, unknown>)[id] = parsed.data;
    else errors.push({ step: id, code: "AGENT_OUTPUT_INVALID", message: parsed.error.message.slice(0, 500) });
  }
  return { artifacts, errors };
}

export const collectAnalysesStep = createStep({
  id: "collect-analyses",
  description: "汇总并行分析的产物",
  inputSchema: analysisResultsSchema,
  outputSchema: adviseInputSchema,
  execute: async ({ inputData, getStepResult, writer, mastra }): Promise<AdviseInput> => {
    const previous = getStepResult(collectDigestsStep);
    const merged = mergeResults(inputData, { artifacts: {}, errors: previous.errors });
    const log = createRunLogger({
      runId: previous.ctx.runId,
      step: "collect-analyses",
      writer,
      logger: mastra?.getLogger(),
    });
    const total = Object.keys(inputData).length;
    const succeeded = Object.keys(merged.artifacts).length;
    await (succeeded < total ? log.warn : log.info)(
      `分析阶段结束：${succeeded}/${total} 项成功，进入技术选型（各项结果暂存在工作流状态中，生成报告时写入 report.json）`,
    );
    return { ...previous, ...merged };
  },
});
