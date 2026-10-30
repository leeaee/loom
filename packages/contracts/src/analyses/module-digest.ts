import { z } from "zod";

/** 大仓库预处理：每个顶层目录一份摘要，供后续分析缩小阅读范围。 */
export const moduleDigestSchema = z.object({
  module: z.string().describe("顶层目录名"),
  summary: z.string().describe("该模块做什么，2-4 句"),
  responsibilities: z.array(z.string()),
  keyFiles: z.array(z.object({ path: z.string(), role: z.string() })),
  publicSurface: z.array(z.string()).describe("对外暴露的入口、导出或接口名"),
  dependsOn: z.array(z.string()).describe("依赖的其他顶层模块或外部服务"),
});
export type ModuleDigest = z.infer<typeof moduleDigestSchema>;
