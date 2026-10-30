import { moduleDigestSchema, stepErrorSchema } from "@loom/contracts";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  type AnalysisInput,
  analysisInputSchema,
  type digestResultSchema,
  moduleDigestModule,
  type RunContext,
  runContextSchema,
} from "../../../analyses/index";
import { digestModules } from "../../../domain/index";
import { createRunLogger } from "../../../infra/index";
import { scoutRepoStep } from "./scout-repo";

export const digestedSchema = z.object({
  digests: z.array(moduleDigestSchema),
  errors: z.array(stepErrorSchema),
});
type Digested = z.infer<typeof digestedSchema>;

/** 大仓库：每个顶层目录并发 3 个做模块摘要。 */
export const digestModulesWorkflow = createWorkflow({
  id: "digest-modules",
  description: "按顶层目录并发生成模块摘要",
  inputSchema: runContextSchema,
  outputSchema: digestedSchema,
})
  .map(
    async ({ inputData }) => digestModules(inputData.scout).map((module) => ({ ctx: inputData, module })),
    {
      id: "plan-digests",
    },
  )
  .foreach(moduleDigestModule.step, { concurrency: 3 })
  .map(
    async ({ inputData }): Promise<Digested> => {
      const results = inputData as z.infer<typeof digestResultSchema>[];
      return {
        digests: results.flatMap((r) => (r.digest ? [r.digest] : [])),
        errors: results.flatMap((r) => (r.error ? [r.error] : [])),
      };
    },
    { id: "merge-digests" },
  )
  .commit();

/** 小仓库：不做摘要。 */
export const skipDigestStep = createStep({
  id: "skip-digest",
  description: "源文件未超过阈值，跳过模块摘要",
  inputSchema: runContextSchema,
  outputSchema: digestedSchema,
  execute: async () => ({ digests: [], errors: [] }),
});

export const isLargeRepo = async ({ inputData }: { inputData: RunContext }) => inputData.scout.large;
export const isSmallRepo = async ({ inputData }: { inputData: RunContext }) => !inputData.scout.large;

/** 合并分支输出，并带上运行上下文，作为 analyze 阶段的输入。 */
export const collectDigestsStep = createStep({
  id: "collect-digests",
  description: "汇总模块摘要",
  inputSchema: z.object({
    "digest-modules": digestedSchema.optional(),
    "skip-digest": digestedSchema.optional(),
  }),
  outputSchema: analysisInputSchema,
  execute: async ({ inputData, getStepResult, writer, mastra }): Promise<AnalysisInput> => {
    const ctx = getStepResult(scoutRepoStep);
    const branch = inputData["digest-modules"] ?? inputData["skip-digest"] ?? { digests: [], errors: [] };
    if (inputData["digest-modules"]) {
      const log = createRunLogger({
        runId: ctx.runId,
        step: "digest-modules",
        writer,
        logger: mastra?.getLogger(),
      });
      const failed = branch.errors.length;
      await (failed ? log.warn : log.info)(
        `模块摘要完成：成功 ${branch.digests.length} 个${failed ? `，失败 ${failed} 个` : ""}`,
      );
    }
    return { ctx, digests: branch.digests, errors: branch.errors };
  },
});
