import {
  analysisIdSchema,
  artifactsSchema,
  moduleDigestSchema,
  repoRefSchema,
  repoScoutSchema,
  stepErrorSchema,
} from "@loom/contracts";
import { z } from "zod";

/** 工作流各步骤之间传递的运行上下文（不含任何密钥，会被持久化到快照）。 */
export const runContextSchema = z.object({
  runId: z.string(),
  repo: repoRefSchema,
  checkoutDir: z.string(),
  mode: z.enum(["real", "fake"]),
  model: z.string().nullable(),
  cacheKey: z.string(),
  scout: repoScoutSchema,
});
export type RunContext = z.infer<typeof runContextSchema>;

/** analyze 阶段步骤的输入。 */
export const analysisInputSchema = z.object({
  ctx: runContextSchema,
  digests: z.array(moduleDigestSchema),
  errors: z.array(stepErrorSchema),
});
export type AnalysisInput = z.infer<typeof analysisInputSchema>;

/** advise 阶段步骤的输入：额外带上 analyze 阶段的全部产物。 */
export const adviseInputSchema = analysisInputSchema.extend({ artifacts: artifactsSchema });
export type AdviseInput = z.infer<typeof adviseInputSchema>;

/** 每个分析步骤的输出。失败不抛出，写入 error，后续步骤照常运行。 */
export const analysisResultSchema = z.object({
  id: analysisIdSchema,
  artifact: z.unknown().nullable(),
  error: stepErrorSchema.nullable(),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const digestItemSchema = z.object({ ctx: runContextSchema, module: z.string() });
export const digestResultSchema = z.object({
  digest: moduleDigestSchema.nullable(),
  error: stepErrorSchema.nullable(),
});
