---
name: loom-add-ui-feature
description: 在 Loom 的 Next.js 界面（apps/web）中新增页面路由、feature 切片、shadcn/ui 组件或数据请求，包括用 contracts 解析服务端数据、文案集中到 copy.ts、TanStack Query/Table 用法和组件测试。做前端页面、交互或展示改动时使用。
---

# 新增界面功能

先读 `apps/web/AGENTS.md`。Next.js 16、React 19.3、Tailwind CSS 4.3、TanStack Table v9 的 API 都与旧版本不同：
- Next.js 以 `node_modules/next/dist/docs/` 为准；
- 表格以 `src/features/report/data-table.tsx` 为准。

## 放在哪里

```text
src/app/<route>/page.tsx          路由：只做组装（读取 params、放置 feature 组件）
src/features/<feature>/           一个业务切片：组件、hook、纯逻辑、测试
src/features/<feature>/index.ts   切片的公开出口；其他切片和 app/ 只能从这里导入
src/components/ui/                shadcn/ui 生成的基础组件
src/lib/                          copy.ts、api.ts、mastra.ts、utils.ts
```

参照：
- `src/app/runs/[runId]/page.tsx`：`params` 是 Promise，需要 `await`；
- `src/features/runs/`：状态归约 + hook + 组件 + 测试；
- `src/features/report/`：注册表驱动的分区。

## 数据从哪里来

- **只经同源 `/mastra/*`**，由 `next.config.ts` 改写到 Mastra。不要直连 4111，不要在 Web 端放密钥。
- **Loom 自定义路由**（`/loom/runs`、报告）：
  - 在 `src/lib/api.ts` 加函数，用 `getJson(path, schema, what)`；
  - 路径来自 contracts 的 `loomRoutes`，schema 来自 `@loom/contracts`。
  - 需要新接口时：
    1. 先在 contracts 加 schema 与路由；
    2. 再在 `apps/loom/src/mastra/routes/` 用 `registerApiRoute` 实现；
    3. 见 `loom-change-contract`。
- **工作流**：
  - 用 `src/lib/mastra.ts` 的 `analyzeWorkflow()`（`@mastra/client-js`）；
  - 事件归约参照 `features/runs/run-state.ts`，用纯函数 reducer，便于测试。
- **请求状态**：
  - 用 TanStack Query（`useQuery` / `useMutation`），queryKey 形如 `["report", runId]`；
  - 轮询用 `refetchInterval`，参照 `features/runs/use-runs.ts`。
- 服务端返回的数据必须经过 contracts 解析；解析失败抛 `ContractError`，界面列出出错字段（参照 `report-view.tsx`）。

## 组件与样式

- 添加 shadcn 组件：

  ```bash
  cd apps/web && npx shadcn@latest add <name>
  ```

  生成后检查 import 是否指向 `@/lib/utils`。CLI 偶尔会写成 `from "cn"` 并安装 `cn` 包，需要改回来并卸载。
- 样式只用 Tailwind 工具类和 `src/app/globals.css` 的主题变量（`bg-muted`、`text-muted-foreground`、`text-success`、`text-warning` 等）；
  新颜色加到 `@theme inline`，不写 `tailwind.config.js`。
- 交互组件文件顶部写 `"use client"`；页面默认是服务端组件。
- 图标用 `lucide-react`。
- 表单 `label` 用 `htmlFor` 关联 `id`，Biome 的 a11y 规则会检查。

## 文案

- 所有用户可见中文放在 `src/lib/copy.ts`，组件里不写字面量文案。
- 按枚举索引的文案用 `satisfies Record<…>`，漏写时编译失败（参照 `copy.analyses`、`copy.runStatus`）。

## 安全

- 模型生成的文本按纯文本渲染，不用 `dangerouslySetInnerHTML`。
- Mermaid 只能经 `features/report/mermaid-diagram.tsx` 渲染（动态导入，`securityLevel: "strict"`，失败时显示原文）。
- 外链加 `rel="noreferrer"`。

## 测试

- 测试与源文件同目录：`*.test.ts` 写纯逻辑，`*.test.tsx` 写组件。
- 数据用 `@loom/contracts/fixtures`。
- 不发真实请求：

  ```ts
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body))));
  ```

  组件需要 Query 时，包一层 `QueryClientProvider`，并设置 `retry: false`。
- 交互用 `@testing-library/user-event`；Mermaid 用 `vi.mock("mermaid", …)`。
- 参照 `src/features/runs/run-state.test.ts` 和 `src/features/report/report.test.tsx`。

## 收尾

```bash
npm test -- --project web
npm run typecheck -w @loom/web
npm run check
```

手工：`npm run dev`，打开 <http://localhost:3000> 检查明暗主题和窄屏布局。
