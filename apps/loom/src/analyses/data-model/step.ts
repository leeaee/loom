import { createAnalyzeStep } from "../shared/create-step";
import { repoContext } from "../shared/prompt";
import { dataModelAgent } from "./agent";

export const dataModelStep = createAnalyzeStep({
  id: "data-model",
  description: "核心数据结构",
  agent: dataModelAgent,
  buildPrompt: ({ ctx, digests }) =>
    `${repoContext(ctx, digests)}\n\n请按 data-model 技能输出该仓库的核心数据结构。`,
});
