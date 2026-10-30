import { z } from "zod";
import { apiCatalogSchema } from "./api-surface";
import { architectureSchema } from "./architecture-flow";
import { dataModelSchema } from "./data-model";
import { techChoiceSchema } from "./tech-choice";

export * from "./api-surface";
export * from "./architecture-flow";
export * from "./common";
export * from "./data-model";
export * from "./module-digest";
export * from "./tech-choice";

/**
 * 报告里的分析模块。id 与 apps/loom/skills 下的技能名一致（kebab-case）。
 * 新增分析：先在这里加 id 和产物 schema，再按 loom-add-analysis 技能补齐其余文件。
 * module-digest 是大仓库的预处理步骤，不在此列。
 */
export const analysisIds = ["api-surface", "data-model", "architecture-flow", "tech-choice"] as const;
export const analysisIdSchema = z.enum(analysisIds);
export type AnalysisId = z.infer<typeof analysisIdSchema>;

export const analysisPhaseSchema = z.enum(["analyze", "advise"]);
export type AnalysisPhase = z.infer<typeof analysisPhaseSchema>;

export const analysisDefinitions = {
  "api-surface": { phase: "analyze", artifact: apiCatalogSchema },
  "data-model": { phase: "analyze", artifact: dataModelSchema },
  "architecture-flow": { phase: "analyze", artifact: architectureSchema },
  "tech-choice": { phase: "advise", artifact: techChoiceSchema },
} as const satisfies Record<AnalysisId, { phase: AnalysisPhase; artifact: z.ZodType }>;

export type ArtifactOf<Id extends AnalysisId> = z.infer<(typeof analysisDefinitions)[Id]["artifact"]>;

/** 以 AnalysisId 为键的产物表；某个分析失败时对应键缺失，原因记录在 report.errors。 */
export const artifactsSchema = z.object({
  "api-surface": apiCatalogSchema.optional(),
  "data-model": dataModelSchema.optional(),
  "architecture-flow": architectureSchema.optional(),
  "tech-choice": techChoiceSchema.optional(),
} satisfies Record<AnalysisId, z.ZodType>);
export type Artifacts = z.infer<typeof artifactsSchema>;
