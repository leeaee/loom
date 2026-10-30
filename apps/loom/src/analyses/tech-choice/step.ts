import { createAdviseStep } from "../shared/create-step";
import { artifactsContext, repoContext } from "../shared/prompt";
import { techChoiceAgent } from "./agent";

export const techChoiceStep = createAdviseStep({
  id: "tech-choice",
  description: "技术选型建议",
  agent: techChoiceAgent,
  buildPrompt: ({ ctx, digests, artifacts, errors }) =>
    [
      repoContext(ctx, digests),
      "",
      "前序分析产物（JSON，可能有缺失）：",
      artifactsContext(artifacts),
      errors.length ? `\n前序步骤的错误：${errors.map((e) => `${e.step}: ${e.message}`).join("；")}` : "",
      "",
      "请按 tech-choice 技能输出技术选型评估与建议（techChoice）。前序产物只作线索，结论必须回到仓库里核实。",
    ].join("\n"),
});
