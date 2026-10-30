<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web（@loom/web）

Next.js 16 界面，本机单用户。先读根目录 `AGENTS.md`，这里只写本包的局部规则。上面的 Next.js 区块由 `next dev` 维护，不要删除。

## 结构

```text
src/app/                  路由（App Router）；页面只做组装，逻辑放 features
src/features/runs/        提交、结论横幅、进度时间线、运行日志、最近运行（useAnalysisRun、runReducer、deriveOutcome）
src/features/report/      报告标签页、分区注册表、Mermaid、表格、引用
src/features/runtime/     首页“运行环境”卡片（模式、模型、接口地址、数据目录）
src/components/ui/        shadcn/ui 生成的组件
src/lib/                  copy.ts（全部中文文案）、api.ts（contracts 解析）、mastra.ts（client-js）
```

## 规则

- 只能依赖 `@loom/contracts`，不能引用 `apps/loom`。服务端返回的数据一律用 contracts 的 schema 再解析一次
  （`lib/api.ts`），不符合时抛 `ContractError` 并展示具体字段。
- 浏览器经同源 `/mastra/*` 访问 Mastra，由 `next.config.ts` 改写到 `LOOM_SERVER_URL`（默认 `http://localhost:4111`）。
  不要在浏览器里直连 4111，也不要在 Web 端放模型密钥。
- feature 之间只经对方的 `index.ts` 引用。
- 启动工作流运行必须用 `run.stream()`（读到首个事件后断开即可），不要用 `start()`：
  只有 `stream` 启动的运行才有可供 `observe()` 回放的事件流，否则运行页收不到实时进度与日志。
- 用户可见文案全部放 `src/lib/copy.ts`；需要按分析 id 索引的文案用 `satisfies Record<AnalysisId, …>`，漏写会编译失败。
- 新增报告分区：`features/report/sections/<id>.tsx` + `sections/registry.ts`，类型 `SectionProps<Id>` 保证拿到正确的产物类型。
- 模型生成的文本按纯文本渲染，不用 `dangerouslySetInnerHTML`；Mermaid 只在客户端动态导入，`securityLevel: "strict"`。
- 样式：Tailwind CSS 4.3，CSS 优先（`src/app/globals.css` 的 `@theme`），没有 `tailwind.config.js`。
- 组件：`npx shadcn@latest add <name>`（在 `apps/web` 下执行），生成后确认 import 指向 `@/lib/utils`。
- 表格用 TanStack Table v9（`tableFeatures` / `useTable`），API 与 v8 不同，以 `features/report/data-table.tsx` 为准。
- `params` 是 Promise，页面里 `await params`。

## 测试

Vitest + jsdom + React Testing Library，测试与源文件同目录（`*.test.ts(x)`）。用 `@loom/contracts/fixtures` 的夹具，
不发真实请求（`vi.stubGlobal("fetch", …)`），Mermaid 用 `vi.mock("mermaid")`。运行：`npm test -- --project web`。
