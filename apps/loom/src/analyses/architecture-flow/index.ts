import type { AnalysisModule } from "../module";
import { architectureFlowAgent } from "./agent";
import { architectureFlowStep } from "./step";

export const architectureFlowModule = {
  id: "architecture-flow",
  title: "架构图",
  skill: "architecture-flow",
  phase: "analyze",
  agent: architectureFlowAgent,
  step: architectureFlowStep,
} satisfies AnalysisModule<"architecture-flow">;
