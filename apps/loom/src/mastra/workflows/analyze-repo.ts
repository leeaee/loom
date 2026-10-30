import { ANALYZE_WORKFLOW_ID, analyzeInputSchema, analyzeOutputSchema } from "@loom/contracts";
import { createWorkflow } from "@mastra/core/workflows";
import { adviseModules, analyzeModules } from "../../analyses/index";
import { releaseRunResources } from "../../infra/index";
import { collectAnalysesStep } from "./steps/collect-analyses";
import {
  collectDigestsStep,
  digestModulesWorkflow,
  isLargeRepo,
  isSmallRepo,
  skipDigestStep,
} from "./steps/digest";
import { renderStep } from "./steps/render";
import { scoutRepoStep } from "./steps/scout-repo";
import { syncRepoStep } from "./steps/sync-repo";

/**
 * sync-repo → scout-repo → [大仓库: 模块摘要 | 小仓库: 跳过] → 并行 analyze → 汇总 → 并行 advise → render。
 * analyze / advise 两段由分析注册表生成；分析步骤自身不抛错，单个失败不影响其他分析与顾问。
 */
export const analyzeRepoWorkflow = createWorkflow({
  id: ANALYZE_WORKFLOW_ID,
  description: "同步 Git 仓库并生成 API、数据结构、架构流程与技术选型报告",
  inputSchema: analyzeInputSchema,
  outputSchema: analyzeOutputSchema,
  options: {
    onFinish: async ({ runId }) => {
      await releaseRunResources(runId);
    },
  },
})
  .then(syncRepoStep)
  .then(scoutRepoStep)
  .branch([
    [isLargeRepo, digestModulesWorkflow],
    [isSmallRepo, skipDigestStep],
  ])
  .then(collectDigestsStep)
  .parallel(analyzeModules.map((m) => m.step))
  .then(collectAnalysesStep)
  .parallel(adviseModules.map((m) => m.step))
  .then(renderStep)
  .commit();
