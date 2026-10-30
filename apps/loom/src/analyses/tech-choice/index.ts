import type { AnalysisModule } from "../module";
import { techChoiceAgent } from "./agent";
import { techChoiceStep } from "./step";

export const techChoiceModule = {
  id: "tech-choice",
  title: "技术选型",
  skill: "tech-choice",
  phase: "advise",
  agent: techChoiceAgent,
  step: techChoiceStep,
} satisfies AnalysisModule<"tech-choice">;
