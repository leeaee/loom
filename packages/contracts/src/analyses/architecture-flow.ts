import { z } from "zod";
import { citationSchema } from "./common";

export const componentSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, "id 只能包含字母、数字和下划线，供 Mermaid 节点使用"),
  name: z.string(),
  kind: z.enum(["service", "module", "library", "datastore", "external", "ui", "other"]),
  responsibility: z.string(),
  citations: z.array(citationSchema),
});
export type Component = z.infer<typeof componentSchema>;

export const flowSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()).min(1),
  citations: z.array(citationSchema),
});
export type Flow = z.infer<typeof flowSchema>;

/** architecture-flow 分析产物：组件、组件关系、关键流程与 Mermaid flowchart。 */
export const architectureSchema = z.object({
  summary: z.string(),
  components: z.array(componentSchema),
  relations: z.array(z.object({ from: z.string(), to: z.string(), label: z.string() })),
  flows: z.array(flowSchema),
  mermaid: z.string().describe("以 flowchart 开头的 Mermaid 文本，节点 id 与 components[].id 一致"),
});
export type Architecture = z.infer<typeof architectureSchema>;
