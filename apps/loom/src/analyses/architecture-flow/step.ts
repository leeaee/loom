import { createAnalyzeStep } from "../shared/create-step";
import { repoContext } from "../shared/prompt";
import { architectureFlowAgent } from "./agent";

export const architectureFlowStep = createAnalyzeStep({
  id: "architecture-flow",
  description: "架构与关键流程",
  agent: architectureFlowAgent,
  buildPrompt: ({ ctx, digests }) =>
    `${repoContext(ctx, digests)}\n\n请按 architecture-flow 技能输出该仓库的架构与流程（architecture），包含 Mermaid flowchart。`,
});
