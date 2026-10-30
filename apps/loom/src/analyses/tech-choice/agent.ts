import { createAnalysisAgent } from "../shared/create-agent";

export const techChoiceAgent = createAnalysisAgent({
  id: "tech-choice-agent",
  name: "技术选型顾问",
  description: "基于前序分析与仓库证据，评估现有技术栈并给出有依据的选型建议。",
  skill: "tech-choice",
  instructions: `任务：作为顾问评估技术选型。
- current：从清单文件与代码里确认的现有选择（运行时、框架、存储、测试、构建、部署），附评价。
- recommendations：只给有证据支撑的建议；rationale 必须引用仓库里的具体现象；alternatives 写清取舍；confidence 如实标注。
- 每条判断都要有 citations 指向仓库内路径。没有证据的建议不要写。`,
});
