import { createAnalyzeStep } from "../shared/create-step";
import { repoContext } from "../shared/prompt";
import { apiSurfaceAgent } from "./agent";

export const apiSurfaceStep = createAnalyzeStep({
  id: "api-surface",
  description: "API 接口清单",
  agent: apiSurfaceAgent,
  buildPrompt: ({ ctx, digests }) =>
    `${repoContext(ctx, digests)}\n\n请按 api-surface 技能输出该仓库的接口清单。`,
});
