import { z } from "zod";
import { citationSchema } from "./common";

export const apiKindSchema = z.enum(["http", "rpc", "graphql", "cli", "library", "event", "other"]);
export type ApiKind = z.infer<typeof apiKindSchema>;

export const apiEntrySchema = z.object({
  kind: apiKindSchema,
  name: z.string().describe("路由路径、命令名、导出符号或事件名"),
  method: z.string().nullable().describe("HTTP 方法等；不适用时为 null"),
  signature: z.string().nullable().describe("参数与返回类型的简写"),
  description: z.string(),
  citations: z.array(citationSchema).min(1),
});
export type ApiEntry = z.infer<typeof apiEntrySchema>;

/** api-surface 分析产物：仓库对外暴露的接口清单。 */
export const apiCatalogSchema = z.object({
  summary: z.string(),
  entries: z.array(apiEntrySchema),
});
export type ApiCatalog = z.infer<typeof apiCatalogSchema>;
