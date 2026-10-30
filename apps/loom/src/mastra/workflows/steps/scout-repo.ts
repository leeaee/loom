import { createStep } from "@mastra/core/workflows";
import { runContextSchema } from "../../../analyses/index";
import { loadConfig } from "../../../config/index";
import { scoutRepo } from "../../../domain/index";
import { createRunLogger, listRepoFiles } from "../../../infra/index";
import { syncedSchema } from "./sync-repo";

/** 只看文件清单得出仓库概况，决定是否需要模块摘要。假模式下同样真实执行。 */
export const scoutRepoStep = createStep({
  id: "scout-repo",
  description: "扫描文件清单，统计语言与模块",
  inputSchema: syncedSchema,
  outputSchema: runContextSchema,
  execute: async ({ inputData, writer, mastra }) => {
    const log = createRunLogger({
      runId: inputData.runId,
      step: "scout-repo",
      writer,
      logger: mastra?.getLogger(),
    });
    const threshold = loadConfig().splitFileThreshold;
    const files = await listRepoFiles(inputData.checkoutDir);
    const scout = scoutRepo(files, threshold);
    const languages = scout.languages
      .slice(0, 5)
      .map((l) => `${l.language} ${l.files}`)
      .join("、");
    await log.info(
      `扫描 ${inputData.checkoutDir}：共 ${scout.totalFiles} 个文件，源文件 ${scout.sourceFiles} 个，顶层目录 ${scout.topLevelDirs.length} 个` +
        `${languages ? `；语言：${languages}` : ""}${scout.hasTsconfig ? "；发现 tsconfig.json" : ""}`,
    );
    await log.info(
      scout.large
        ? `源文件超过阈值 ${threshold}，先按顶层目录做模块摘要`
        : `源文件未超过阈值 ${threshold}，跳过模块摘要`,
    );
    return { ...inputData, scout };
  },
});
