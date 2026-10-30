import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getRunStore } from "../runtime";

/** 供外部 MCP 客户端读取报告：Markdown 适合直接给模型阅读。 */
export const getReportTool = createTool({
  id: "getReport",
  description: "读取一次 Loom 分析运行的报告。format=markdown 返回可读报告，format=json 返回结构化报告。",
  inputSchema: z.object({
    runId: z.string().min(1).describe("run_analyzeRepo 返回的 runId"),
    format: z.enum(["markdown", "json"]).default("markdown"),
  }),
  outputSchema: z.object({ runId: z.string(), format: z.enum(["markdown", "json"]), content: z.string() }),
  execute: async ({ runId, format }) => {
    const store = getRunStore();
    const content =
      format === "json"
        ? JSON.stringify(await store.readReport(runId), null, 2)
        : await store.readMarkdown(runId);
    return { runId, format, content };
  },
});
