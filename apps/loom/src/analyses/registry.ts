import type { AnalysisId } from "@loom/contracts";
import type { Agent } from "@mastra/core/agent";
import { apiSurfaceModule } from "./api-surface/index";
import { architectureFlowModule } from "./architecture-flow/index";
import { dataModelModule } from "./data-model/index";
import type { AnalysisModule } from "./module";
import { moduleDigestModule } from "./module-digest/index";
import { techChoiceModule } from "./tech-choice/index";

/**
 * 分析模块注册表。新增分析：在 contracts 加 id 与 schema → 实现模块 → 加到这里。
 * 注册表一致性测试会检查每个 analysisId 都有模块、技能目录和 Web 分区。
 */
export const analysisModules = [
  apiSurfaceModule,
  dataModelModule,
  architectureFlowModule,
  techChoiceModule,
] as const satisfies readonly AnalysisModule[];

export const analyzeModules = analysisModules.filter(
  (m): m is Extract<(typeof analysisModules)[number], { phase: "analyze" }> => m.phase === "analyze",
);
export const adviseModules = analysisModules.filter(
  (m): m is Extract<(typeof analysisModules)[number], { phase: "advise" }> => m.phase === "advise",
);

export { moduleDigestModule };

export function getAnalysisModule(id: AnalysisId): AnalysisModule {
  const found = analysisModules.find((m) => m.id === id);
  if (!found) throw new Error(`未注册的分析模块：${id}`);
  return found;
}

/** 所有 Agent，按 id 注册到 Mastra（Studio 可见）。 */
export const analysisAgents: Record<string, Agent> = Object.fromEntries(
  [...analysisModules, moduleDigestModule].map((m) => [m.agent.id, m.agent]),
);

/** 所有分析与预处理用到的运行时技能名。 */
export const runtimeSkillNames: string[] = [...analysisModules.map((m) => m.skill), moduleDigestModule.skill];
