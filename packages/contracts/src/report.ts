import { z } from "zod";
import { analysisIdSchema, artifactsSchema, moduleDigestSchema } from "./analyses/index";
import { repoRefSchema, repoScoutSchema } from "./repo";
import { agentModeSchema, workflowStepIdSchema } from "./run";

export const REPORT_SCHEMA_VERSION = 1;

export const stepErrorSchema = z.object({
  step: z.union([workflowStepIdSchema, analysisIdSchema, z.string()]),
  code: z.string(),
  message: z.string(),
});
export type StepError = z.infer<typeof stepErrorSchema>;

/** render 步骤对全部引用做的核实结果：路径不存在或行号越界即为未核实。 */
export const citationCheckSchema = z.object({
  total: z.number().int().nonnegative(),
  verified: z.number().int().nonnegative(),
  unverified: z.array(
    z.object({
      source: z.string().describe("产生该引用的分析 id 或 digest:<module>"),
      path: z.string(),
      line: z.number().int().nullable(),
      reason: z.enum(["missing-file", "line-out-of-range"]),
    }),
  ),
});
export type CitationCheck = z.infer<typeof citationCheckSchema>;

/** report.json 的结构；report.md 由它渲染。 */
export const reportSchema = z.object({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  runId: z.string(),
  createdAt: z.string(),
  mode: agentModeSchema,
  model: z.string().nullable().describe("模型标识；配置了 LOOM_MODEL_URL 时形如 provider/model @ url"),
  repo: repoRefSchema,
  scout: repoScoutSchema,
  digests: z.array(moduleDigestSchema),
  artifacts: artifactsSchema,
  errors: z.array(stepErrorSchema),
  citationCheck: citationCheckSchema,
});
export type Report = z.infer<typeof reportSchema>;
