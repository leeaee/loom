import type { AnalysisModule } from "../module";
import { dataModelAgent } from "./agent";
import { dataModelStep } from "./step";

export const dataModelModule = {
  id: "data-model",
  title: "数据结构",
  skill: "data-model",
  phase: "analyze",
  agent: dataModelAgent,
  step: dataModelStep,
} satisfies AnalysisModule<"data-model">;
