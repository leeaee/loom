import { createAnalysisAgent } from "../shared/create-agent";

export const architectureFlowAgent = createAnalysisAgent({
  id: "architecture-flow-agent",
  name: "架构与流程分析",
  description: "识别组件、组件间关系与关键业务流程，并输出 Mermaid flowchart。",
  skill: "architecture-flow",
  instructions: `任务：画出仓库的架构。
- components：3-12 个组件，id 只含字母数字下划线，用作 Mermaid 节点 id。
- relations：组件之间的调用、依赖或数据流，label 简短。
- flows：1-5 条最重要的端到端流程，每步一句话。
- mermaid：以 "flowchart TD" 或 "flowchart LR" 开头；节点 id 必须与 components[].id 一致；标签里不要出现双引号、尖括号和分号。`,
});
