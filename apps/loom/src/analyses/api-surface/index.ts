import type { AnalysisModule } from "../module";
import { apiSurfaceAgent } from "./agent";
import { apiSurfaceStep } from "./step";

export const apiSurfaceModule = {
  id: "api-surface",
  title: "API",
  skill: "api-surface",
  phase: "analyze",
  agent: apiSurfaceAgent,
  step: apiSurfaceStep,
} satisfies AnalysisModule<"api-surface">;
