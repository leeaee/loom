import type { AnalysisId, ArtifactOf, ModuleDigest } from "../analyses/index";

/**
 * 假模式与测试共用的产物夹具，描述一个虚构的 todo-api 仓库（Express + Prisma）。
 * 修改合同时同步更新这里；contracts 自带测试会用 schema 校验它们。
 */
export const fixtureArtifacts: { [Id in AnalysisId]: ArtifactOf<Id> } = {
  "api-surface": {
    summary: "REST 服务，提供待办事项的增删改查，另有健康检查与一个导入命令。",
    entries: [
      {
        kind: "http",
        name: "/todos",
        method: "GET",
        signature: "(query: { done?: boolean }) => Todo[]",
        description: "列出待办，可按完成状态过滤。",
        citations: [{ path: "src/routes/todos.ts", line: 12 }],
      },
      {
        kind: "http",
        name: "/todos",
        method: "POST",
        signature: "(body: CreateTodo) => Todo",
        description: "创建待办，body 经 Zod 校验。",
        citations: [{ path: "src/routes/todos.ts", line: 28 }],
      },
      {
        kind: "http",
        name: "/todos/:id",
        method: "PATCH",
        signature: "(id: string, body: UpdateTodo) => Todo",
        description: "更新标题或完成状态。",
        citations: [{ path: "src/routes/todos.ts", line: 47 }],
      },
      {
        kind: "http",
        name: "/healthz",
        method: "GET",
        signature: null,
        description: "存活检查。",
        citations: [{ path: "src/server.ts", line: 20 }],
      },
      {
        kind: "cli",
        name: "todo-import",
        method: null,
        signature: "todo-import <file.csv>",
        description: "从 CSV 批量导入待办。",
        citations: [{ path: "src/cli/import.ts", line: null }],
      },
    ],
  },
  "data-model": {
    summary: "两张表：User 与 Todo，一对多。",
    entities: [
      {
        name: "User",
        kind: "table",
        description: "账号。",
        fields: [
          { name: "id", type: "String @id", optional: false, description: "cuid" },
          { name: "email", type: "String @unique", optional: false, description: null },
          { name: "createdAt", type: "DateTime", optional: false, description: null },
        ],
        relations: [{ target: "Todo", kind: "has-many", description: "用户拥有的待办" }],
        citations: [{ path: "prisma/schema.prisma", line: 10 }],
      },
      {
        name: "Todo",
        kind: "table",
        description: "待办事项。",
        fields: [
          { name: "id", type: "String @id", optional: false, description: null },
          { name: "title", type: "String", optional: false, description: null },
          { name: "done", type: "Boolean", optional: false, description: "默认 false" },
          { name: "userId", type: "String", optional: false, description: "外键" },
        ],
        relations: [{ target: "User", kind: "belongs-to", description: null }],
        citations: [{ path: "prisma/schema.prisma", line: 17 }],
      },
    ],
  },
  "architecture-flow": {
    summary: "单体 HTTP 服务：路由层调用服务层，服务层经 Prisma 访问 PostgreSQL。",
    components: [
      {
        id: "routes",
        name: "HTTP 路由",
        kind: "module",
        responsibility: "解析请求、校验输入",
        citations: [{ path: "src/routes/todos.ts", line: null }],
      },
      {
        id: "services",
        name: "业务服务",
        kind: "module",
        responsibility: "待办业务规则",
        citations: [{ path: "src/services/todo-service.ts", line: null }],
      },
      {
        id: "db",
        name: "PostgreSQL",
        kind: "datastore",
        responsibility: "持久化",
        citations: [{ path: "prisma/schema.prisma", line: 1 }],
      },
      {
        id: "cli",
        name: "导入命令",
        kind: "module",
        responsibility: "CSV 导入",
        citations: [{ path: "src/cli/import.ts", line: null }],
      },
    ],
    relations: [
      { from: "routes", to: "services", label: "调用" },
      { from: "cli", to: "services", label: "调用" },
      { from: "services", to: "db", label: "Prisma" },
    ],
    flows: [
      {
        name: "创建待办",
        steps: ["POST /todos", "Zod 校验 body", "todoService.create", "prisma.todo.create", "返回 201"],
        citations: [{ path: "src/routes/todos.ts", line: 28 }],
      },
    ],
    mermaid: [
      "flowchart TD",
      "  routes[HTTP 路由] -->|调用| services[业务服务]",
      "  cli[导入命令] -->|调用| services",
      "  services -->|Prisma| db[(PostgreSQL)]",
    ].join("\n"),
  },
  "tech-choice": {
    summary: "整体选型合理；建议把 Express 换成 Fastify 或 Hono 以获得类型化路由，并补上集成测试。",
    current: [
      {
        category: "Web 框架",
        choice: "Express 4",
        assessment: "成熟但缺少内建类型推导与 schema 校验。",
        citations: [{ path: "package.json", line: null }],
      },
      {
        category: "ORM",
        choice: "Prisma",
        assessment: "类型安全，迁移工具完善。",
        citations: [{ path: "prisma/schema.prisma", line: null }],
      },
    ],
    recommendations: [
      {
        category: "Web 框架",
        recommendation: "迁移到 Hono",
        rationale: "路由已用 Zod 校验，Hono 的 zod-validator 可直接复用并推导类型。",
        alternatives: [
          { name: "Fastify", tradeoff: "生态大、性能好，但插件模型更重。" },
          { name: "保持 Express", tradeoff: "零迁移成本，继续手写类型。" },
        ],
        confidence: "medium",
        citations: [{ path: "src/routes/todos.ts", line: 28 }],
      },
      {
        category: "测试",
        recommendation: "用 Vitest + Testcontainers 补数据库集成测试",
        rationale: "目前只有单元测试，服务层与数据库的交互没有覆盖。",
        alternatives: [{ name: "SQLite 内存库", tradeoff: "快，但与 PostgreSQL 行为不一致。" }],
        confidence: "high",
        citations: [{ path: "package.json", line: null }],
      },
    ],
  },
};

export function fixtureDigest(module: string): ModuleDigest {
  return {
    module,
    summary: `${module} 目录的夹具摘要（假模式）。`,
    responsibilities: ["示例职责"],
    keyFiles: [],
    publicSurface: [],
    dependsOn: [],
  };
}
