import { moduleDigestAgent } from "./agent";
import { moduleDigestStep } from "./step";

/** 大仓库预处理模块。不在 analysisIds 中，由工作流的分支单独调用。 */
export const moduleDigestModule = {
  id: "module-digest",
  title: "模块摘要",
  skill: "module-digest",
  agent: moduleDigestAgent,
  step: moduleDigestStep,
} as const;
