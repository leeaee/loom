/**
 * Loom 分层规则。违反即 `npm run deps:check` 失败。
 * 层次：contracts → domain → infra → analyses → mastra → cli；web 只依赖 contracts。
 * @type {import('dependency-cruiser').IConfiguration}
 */
const LOOM = "^apps/loom/src";

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "禁止循环依赖。",
      from: {},
      to: { circular: true },
    },
    {
      name: "contracts-only-zod",
      severity: "error",
      comment: "packages/contracts 只能依赖 zod 与自身。",
      from: { path: "^packages/contracts/src", pathNot: "\\.test\\.ts$" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional", "npm-no-pkg", "npm-unknown"],
        pathNot: "node_modules/zod",
      },
    },
    {
      name: "contracts-no-app",
      severity: "error",
      comment: "contracts 不能引用任何 app。",
      from: { path: "^packages/contracts" },
      to: { path: "^apps/" },
    },
    {
      name: "web-only-contracts",
      severity: "error",
      comment: "apps/web 不能引用 apps/loom，只能通过 @loom/contracts 共享代码。",
      from: { path: "^apps/web" },
      to: { path: "^apps/loom" },
    },
    {
      name: "loom-no-web",
      severity: "error",
      from: { path: "^apps/loom" },
      to: { path: "^apps/web" },
    },
    {
      name: "web-features-via-index",
      severity: "error",
      comment: "features 之间只能通过对方的 index.ts 引用。",
      from: { path: "^apps/web/src/features/([^/]+)/" },
      to: {
        path: "^apps/web/src/features/([^/]+)/.+",
        pathNot: ["^apps/web/src/features/$1/", "^apps/web/src/features/[^/]+/index\\.tsx?$"],
      },
    },
    {
      name: "domain-pure",
      severity: "error",
      comment: "domain 是纯逻辑：不能依赖 Mastra、git、网络、文件系统，也不能依赖上层。",
      from: { path: `${LOOM}/domain` },
      to: {
        path: [
          "node_modules/@mastra",
          "node_modules/simple-git",
          "^(node:)?(fs|fs/promises|child_process|net|http|https|os)$",
          `${LOOM}/(infra|analyses|mastra|cli|config)`,
        ],
      },
    },
    {
      name: "config-leaf",
      severity: "error",
      comment: "config 只读取环境变量，不依赖其他 Loom 层。",
      from: { path: `${LOOM}/config` },
      to: { path: `${LOOM}/(domain|infra|analyses|mastra|cli)` },
    },
    {
      name: "infra-no-upper",
      severity: "error",
      from: { path: `${LOOM}/infra` },
      to: { path: `${LOOM}/(analyses|mastra|cli)` },
    },
    {
      name: "analyses-no-upper",
      severity: "error",
      comment: "分析模块不能依赖组合根或 CLI。",
      from: { path: `${LOOM}/analyses` },
      to: { path: `${LOOM}/(mastra|cli)` },
    },
    {
      name: "mastra-no-cli",
      severity: "error",
      from: { path: `${LOOM}/mastra` },
      to: { path: `${LOOM}/cli` },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["\\.next", "\\.mastra", "node_modules", "\\.loom", "\\.d\\.ts$"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
