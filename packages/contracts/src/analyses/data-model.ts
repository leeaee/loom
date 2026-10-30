import { z } from "zod";
import { citationSchema } from "./common";

export const entityKindSchema = z.enum(["table", "type", "schema", "class", "message", "other"]);

export const entityFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean(),
  description: z.string().nullable(),
});

export const entityRelationSchema = z.object({
  target: z.string().describe("关联实体名"),
  kind: z.enum(["has-one", "has-many", "belongs-to", "many-to-many", "references"]),
  description: z.string().nullable(),
});

export const entitySchema = z.object({
  name: z.string(),
  kind: entityKindSchema,
  description: z.string(),
  fields: z.array(entityFieldSchema),
  relations: z.array(entityRelationSchema),
  citations: z.array(citationSchema).min(1),
});
export type Entity = z.infer<typeof entitySchema>;

/** data-model 分析产物：核心数据结构与关系。 */
export const dataModelSchema = z.object({
  summary: z.string(),
  entities: z.array(entitySchema),
});
export type DataModel = z.infer<typeof dataModelSchema>;
