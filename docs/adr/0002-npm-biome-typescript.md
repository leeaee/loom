# 0002 npm workspaces、Biome 与 TypeScript 7/6 并装

- 状态：已采纳
- 日期：2026-10-29

## 背景与问题

仓库会由多人、多种 AI 工具共同开发。工具链要尽量少、结果确定，让不同来源的代码风格一致，本地与 CI 用同一个门槛。

## 决定

- **包管理**：npm workspaces（npm 12，Node 24 LTS）。根 `package.json` 用 `devEngines` 锁定 Node 与 npm，
  `.npmrc` 设 `engine-strict=true`、`save-exact=true`；唯一锁文件 `package-lock.json`，CI 用 `npm ci`。
  包间引用写 `"@loom/contracts": "*"`（npm 不支持 `workspace:` 协议）。
- **格式化与 lint**：Biome 2，根目录一份配置，开启 React 与 Next 规则域。
- **类型检查**：TypeScript 7（Go 原生实现）与 6 并装：
  - `"@typescript/native": "npm:typescript@7.x"` 提供 `tsc`，各包 `typecheck` 用它；
  - `"typescript": "npm:@typescript/typescript6@6.x"` 提供 JS 编译器 API，给 dependency-cruiser 等需要 API 的工具。
- **分层**：dependency-cruiser 把分层规则写成检查。
- **测试**：Vitest projects 汇总各包。
- **钩子与提交**：lefthook（pre-commit 跑 Biome、commit-msg 跑 commitlint）、Conventional Commits。
- **升级**：Renovate 每周，`@mastra/*`、Next/React、Tailwind、TypeScript、工具链分组。

## 理由

- npm 随 Node 自带，新人与 AI 工具不需要额外安装；团队明确要求统一用 npm。
- Biome 一个工具替代 ESLint + Prettier，格式化确定、速度快，不同 AI 生成的 diff 风格一致。
- TypeScript 7 的 `tsc` 快约 10 倍，但 7.0 还没有 JS API；并装是 TypeScript 团队推荐的过渡方式。
  7.1 提供 API 后去掉 6 的别名，只保留一份。

## 代价

- npm 12 默认拦截依赖的 install 脚本，因此 lefthook 改在根 `prepare` 脚本里安装钩子。
- 两份 TypeScript 增加约 30 MB 安装体积。
- Biome 的规则集比 ESLint 生态少，需要的特定规则只能等 Biome 支持或用 dependency-cruiser 等工具补位。
