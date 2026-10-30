import { createAnalysisAgent } from "../shared/create-agent";

export const moduleDigestAgent = createAnalysisAgent({
  id: "module-digest-agent",
  name: "模块摘要",
  description: "大仓库预处理：为一个顶层目录生成职责、关键文件与对外接口摘要。",
  skill: "module-digest",
  instructions: `任务：只阅读指定的一个顶层目录，写出它的摘要。
- summary 2-4 句；responsibilities 3-6 条；keyFiles 最多 10 个（路径为仓库根相对路径）。
- publicSurface 写该模块对外导出的入口或接口名；dependsOn 写依赖的其他顶层目录或外部服务。
- 控制阅读量：先看目录结构与入口文件，不要逐个读完所有文件。`,
});
