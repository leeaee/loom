import { z } from "zod";
import { citationSchema, confidenceSchema } from "./common";

export const currentChoiceSchema = z.object({
  category: z.string().describe("例如 运行时、Web 框架、ORM、测试"),
  choice: z.string(),
  assessment: z.string().describe("对现状的评价"),
  citations: z.array(citationSchema).min(1),
});

export const recommendationSchema = z.object({
  category: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.object({ name: z.string(), tradeoff: z.string() })),
  confidence: confidenceSchema,
  citations: z.array(citationSchema).min(1),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/** tech-choice 顾问产物：现状评估与有证据的技术选型建议。 */
export const techChoiceSchema = z.object({
  summary: z.string(),
  current: z.array(currentChoiceSchema),
  recommendations: z.array(recommendationSchema),
});
export type TechChoice = z.infer<typeof techChoiceSchema>;
