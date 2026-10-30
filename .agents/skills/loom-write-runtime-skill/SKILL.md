---
name: loom-write-runtime-skill
description: 编写或修改 Loom 运行时技能（apps/loom/skills/<name>/SKILL.md 及其 scripts/），也就是 Loom 的分析 Agent 在运行时加载的技能，包括 frontmatter、步骤写法、辅助脚本约定与沙箱限制。修改分析提示策略、给 Agent 加扫描脚本时使用。不要与 .agents/skills 下的开发者技能混淆。
---

# 编写 Loom 运行时技能

两类技能的区别：

| 目录 | 读者 | 作用 |
| --- | --- | --- |
| `apps/loom/skills/<name>/` | Loom 的分析 Agent（运行时） | 教 Agent 如何分析一个仓库 |
| `.agents/skills/<name>/` | 开发者用的 AI 工具 | 教 AI 如何开发 Loom |

本技能只讲第一类。参照：
- `apps/loom/skills/api-surface/`：带扫描脚本；
- `apps/loom/skills/data-model/`：纯指令。

## 运行环境（Agent 视角）

- 仓库只读挂载在 `/repo`，技能只读挂载在 `/skills`；没有写文件、删除、打补丁工具。
- 命令工具只在宿主有 seatbelt（macOS）或 bubblewrap（Linux）时开启：
  - 断网、只读，只有本次运行的 scratch 目录可写；
  - 工作目录下 `repo/`、`skills/` 是两个挂载的软链接。
- 命令必须通过 `apps/loom/src/domain/command-policy.ts` 的白名单：
  - 格式 `<node|python3|bash|sh> skills/<name>/scripts/<file> [参数...]`；
  - 参数只能是简单的相对路径或标识符；
  - 不能有 shell 元字符、`..` 或绝对路径。
- 被分析仓库的任何代码、包脚本、构建命令都不能执行。
- 仓库含 `tsconfig.json` 时可能有 `tsLanguage` MCP 工具（符号、引用、调用层级），有 `GITHUB_TOKEN` 时可能有 GitHub 只读工具。

## SKILL.md 结构

```markdown
---
name: <name>            # 与目录名一致，kebab-case；分析技能与分析 id 相同
description: 一句话说明产出什么、何时使用（会显示在 Agent 的技能列表里，20~200 字）
---

# 标题

仓库挂载在 `/repo`（只读）。输出必须符合 `<schema 名>` 结构，<引用要求>。

## 步骤 / 去哪里找
按优先级列出要看的文件与模式，写明“找到足够信息就停”，控制步数。

## 规则
- 引用路径相对仓库根，不带 `/repo/` 前缀；line 指向定义行。
- 数量上限与取舍方式（写进 summary）。
- 不要执行仓库里的任何代码。
```

写作要点：

- 面向结果：说明输出 schema 中每个字段怎么填，特别是枚举值的选择标准。
- 给出明确的停止条件和数量上限，Agent 的步数受 `LOOM_MAX_STEPS`（默认 12）限制。
- 脚本不可用时给出退路（例如“用文件搜索工具搜索下列模式”），因为没有沙箱的机器上命令工具是关闭的。
- 中文说明，代码标识符保持原样。

## 辅助脚本（scripts/）

- 只用语言内置库（Node 用 `node:` 模块），不能 `import` 第三方包，沙箱里没有网络也没有 node_modules。
- 输入：第一个参数是仓库目录（调用时传 `repo`）；输出：每行一个 JSON 写到 stdout，设结果上限（参照 `MAX_RESULTS = 500`）。
- 只读：不写文件、不修改仓库、不执行被扫描的代码；跳过 `.git`、`node_modules`、构建目录和大文件。
- 输出用 `process.stdout.write`，不要 `console.log`（Biome 的 noConsole 规则）。
- 参照 `apps/loom/skills/api-surface/scripts/find-routes.mjs`。

## 影响与验证

- 技能目录内容参与缓存键，修改后同一仓库会重新分析。
- 新增技能目录必须对应一个分析模块或 `module-digest`，否则 `apps/loom/test/registry.test.ts` 报“孤立技能目录”。
- 验证：
  - `npm test -- --project loom`：包含技能发现、frontmatter 与沙箱内执行 `find-routes.mjs` 的测试；
  - 手工调试脚本：

    ```bash
    node apps/loom/skills/<name>/scripts/<file> <某个本地仓库目录>
    ```

  - 在 Mastra Studio（<http://localhost:4111>）中打开对应 Agent，用真实模式提问，观察它是否加载并遵循技能。
