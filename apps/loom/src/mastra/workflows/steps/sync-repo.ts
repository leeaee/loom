import { analyzeInputSchema, analyzeOutputSchema, repoRefSchema } from "@loom/contracts";
import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { loadConfig } from "../../../config/index";
import { computeCacheKey, LoomError, parseRepoUrl, renderReportMarkdown } from "../../../domain/index";
import { createRunLogger, hashSkillsDir, syncRepo } from "../../../infra/index";
import { getRunStore } from "../../runtime";

export const syncedSchema = z.object({
  runId: z.string(),
  repo: repoRefSchema,
  checkoutDir: z.string(),
  mode: z.enum(["real", "fake"]),
  model: z.string().nullable(),
  cacheKey: z.string(),
});

/**
 * 解析地址 → 同步仓库 → 记录 SHA → 查缓存。
 * 命中缓存时把上次的报告复制到本次 runId 下，并用 bail 直接结束工作流。
 */
export const syncRepoStep = createStep({
  id: "sync-repo",
  description: "同步 Git 仓库并解析提交 SHA",
  inputSchema: analyzeInputSchema,
  outputSchema: syncedSchema,
  execute: async ({ inputData, runId, bail, writer, mastra }) => {
    const log = createRunLogger({ runId, step: "sync-repo", writer, logger: mastra?.getLogger() });
    const config = loadConfig();
    const parsed = parseRepoUrl(inputData.repoUrl);
    if (!parsed.ok) {
      await log.error(parsed.error.message);
      throw parsed.error;
    }
    if (parsed.value.local && !config.allowLocalRepos) {
      const error = new LoomError(
        "LOCAL_REPO_FORBIDDEN",
        "不允许分析本地路径；如需开启请设置 LOOM_ALLOW_LOCAL_REPOS=true",
      );
      await log.error(error.message);
      throw error;
    }
    const ref = inputData.ref ?? null;
    const repoLabel = `${parsed.value.host}/${parsed.value.owner}/${parsed.value.name}`;
    await log.info(`同步 ${repoLabel}${ref ? ` @ ${ref}` : "（默认分支）"}，模式 ${config.mode}`);

    const startedAt = Date.now();
    let synced: Awaited<ReturnType<typeof syncRepo>>;
    try {
      synced = await syncRepo({
        repo: parsed.value,
        ref,
        token: config.githubToken,
        reposDir: config.paths.reposDir,
      });
    } catch (error) {
      await log.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
    const { sha, checkoutDir } = synced;
    await log.info(`检出提交 ${sha.slice(0, 12)}（${((Date.now() - startedAt) / 1000).toFixed(1)} 秒）`);

    const skillsHash = await hashSkillsDir(config.paths.skillsDir);
    const cacheKey = computeCacheKey({
      url: parsed.value.url,
      sha,
      skillsHash,
      mode: config.mode,
      model: config.model,
    });

    if (inputData.force) {
      await log.info("已勾选重新分析，忽略缓存");
    } else {
      const store = getRunStore();
      const cachedRunId = await store.findCached(cacheKey);
      if (cachedRunId) {
        const report = { ...(await store.readReport(cachedRunId)), runId };
        const reportPath = await store.writeReport(report, renderReportMarkdown(report));
        await log.info(`命中缓存：同一提交与技能版本已在运行 ${cachedRunId} 分析过，直接复用报告`);
        return bail(analyzeOutputSchema.parse({ runId, cached: true, reportPath }));
      }
      await log.info("未命中缓存，开始分析");
    }

    return {
      runId,
      repo: {
        url: parsed.value.url,
        host: parsed.value.host,
        owner: parsed.value.owner,
        name: parsed.value.name,
        ref,
        sha,
      },
      checkoutDir,
      mode: config.mode,
      model: config.model,
      cacheKey,
    };
  },
});
