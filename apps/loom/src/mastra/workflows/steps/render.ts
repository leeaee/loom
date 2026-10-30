import { type AnalyzeOutput, analyzeOutputSchema, REPORT_SCHEMA_VERSION, type Report } from "@loom/contracts";
import { createStep } from "@mastra/core/workflows";
import { collectCitations, renderReportMarkdown, verifyCitations } from "../../../domain/index";
import { createLineCounter, createRunLogger, releaseRunResources } from "../../../infra/index";
import { getRunStore } from "../../runtime";
import { analysisResultsSchema, collectAnalysesStep, mergeResults } from "./collect-analyses";

/** 合并顾问产物、核实引用、写 report.json / report.md，并记录缓存。 */
export const renderStep = createStep({
  id: "render",
  description: "生成报告并核实引用",
  inputSchema: analysisResultsSchema,
  outputSchema: analyzeOutputSchema,
  execute: async ({ inputData, getStepResult, writer, mastra }): Promise<AnalyzeOutput> => {
    const previous = getStepResult(collectAnalysesStep);
    const { ctx, digests } = previous;
    const log = createRunLogger({ runId: ctx.runId, step: "render", writer, logger: mastra?.getLogger() });
    const { artifacts, errors } = mergeResults(inputData, {
      artifacts: previous.artifacts,
      errors: previous.errors,
    });

    const citationCheck = verifyCitations(
      collectCitations(artifacts, digests),
      createLineCounter(ctx.checkoutDir),
    );
    await (citationCheck.unverified.length ? log.warn : log.info)(
      `引用核实：${citationCheck.verified}/${citationCheck.total} 条通过` +
        `${citationCheck.unverified.length ? `，${citationCheck.unverified.length} 条文件不存在或行号越界` : ""}`,
    );

    const report: Report = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      runId: ctx.runId,
      createdAt: new Date().toISOString(),
      mode: ctx.mode,
      model: ctx.model,
      repo: ctx.repo,
      scout: ctx.scout,
      digests,
      artifacts,
      errors,
      citationCheck,
    };

    const store = getRunStore();
    const reportPath = await store.writeReport(report, renderReportMarkdown(report));
    const paths = store.reportPaths(ctx.runId);
    await log.info(`报告已写入 ${paths.json}、${paths.markdown}；运行日志 ${paths.logs}`);
    if (errors.length === 0) {
      const cacheFile = await store.recordCache(ctx.cacheKey, ctx.runId);
      await log.info(`报告已生成并写入缓存（${cacheFile}）`);
    } else {
      await log.warn(`报告已生成，含 ${errors.length} 个步骤错误；有错误的报告不写入缓存`);
    }
    await releaseRunResources(ctx.runId);
    return { runId: ctx.runId, cached: false, reportPath };
  },
});
