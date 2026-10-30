import { createAnalysisAgent } from "../shared/create-agent";

export const dataModelAgent = createAnalysisAgent({
  id: "data-model-agent",
  name: "数据结构分析",
  description: "提取数据库表、ORM 模型、核心类型与消息结构，以及它们之间的关系。",
  skill: "data-model",
  instructions: `任务：找出仓库的核心数据结构。
- 优先级：数据库 schema / 迁移 / ORM 模型 > API 的请求响应类型 > 领域类型与类 > 消息与事件结构。
- 每个实体给出字段（name、type、optional、description）与关系（target、kind）。
- 只收录跨模块使用或持久化的结构，不要罗列所有局部类型。`,
});
