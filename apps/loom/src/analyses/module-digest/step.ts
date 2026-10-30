import { moduleDigestSchema } from "@loom/contracts";
import { fixtureDigest } from "@loom/contracts/fixtures";
import { createStep } from "@mastra/core/workflows";
import { ROOT_MODULE, toStepError } from "../../domain/index";
import { createRunLogger } from "../../infra/index";
import { repoContext } from "../shared/prompt";
import { runAnalysisAgent } from "../shared/run-agent";
import { digestItemSchema, digestResultSchema } from "../types";
import { moduleDigestAgent } from "./agent";

/** 对一个顶层目录做摘要；由工作流 `.foreach(..., { concurrency: 3 })` 调用。 */
export const moduleDigestStep = createStep({
  id: "module-digest",
  description: "单个顶层目录的摘要",
  inputSchema: digestItemSchema,
  outputSchema: digestResultSchema,
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const { ctx, module } = inputData;
    const step = `digest:${module}`;
    const log = createRunLogger({ runId: ctx.runId, step, writer, logger: mastra?.getLogger() });
    const target = module === ROOT_MODULE ? "仓库根目录下的文件（不含子目录）" : `顶层目录 ${module}/`;
    await log.info(`开始摘要：${target}`);
    try {
      const digest = await runAnalysisAgent({
        mastra,
        agent: moduleDigestAgent,
        ctx,
        prompt: `${repoContext(ctx, [])}\n\n请按 module-digest 技能为${target}写摘要，module 字段填 "${module}"。`,
        schema: moduleDigestSchema,
        fixture: () => fixtureDigest(module),
        log,
        abortSignal,
      });
      await log.info(`完成：${digest.keyFiles.length} 个关键文件`);
      return { digest: { ...digest, module }, error: null };
    } catch (error) {
      if (abortSignal?.aborted) throw error;
      const stepError = toStepError(step, error);
      await log.error(`失败（${stepError.code}）：${stepError.message}`);
      return { digest: null, error: stepError };
    }
  },
});
