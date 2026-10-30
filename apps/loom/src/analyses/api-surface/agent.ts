import { createAnalysisAgent } from "../shared/create-agent";

export const apiSurfaceAgent = createAnalysisAgent({
  id: "api-surface-agent",
  name: "API 接口分析",
  description: "梳理仓库对外暴露的 HTTP / RPC / GraphQL / CLI / 库导出 / 事件接口。",
  skill: "api-surface",
  instructions: `任务：列出仓库对外暴露的所有接口。
- 先找入口：路由注册、控制器、GraphQL schema、proto、CLI 参数解析、package.json 的 exports/bin、事件订阅。
- 每个接口给出 kind、name、method（不适用为 null）、signature（参数与返回的简写，未知为 null）、一句话 description。
- 同一路由的不同方法分别列出。内部工具函数不算接口。`,
});
