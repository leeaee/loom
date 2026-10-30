import { z } from "zod";

/** 指向被分析仓库内的一个位置。path 一律是仓库根的相对路径，使用 `/` 分隔。 */
export const citationSchema = z.object({
  path: z.string().min(1).describe("仓库根的相对路径，例如 src/server.ts"),
  line: z.number().int().positive().nullable().describe("起始行号；整文件引用时为 null"),
});
export type Citation = z.infer<typeof citationSchema>;

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;
