# 0004 Harness 的分发方式

- 状态：已采纳
- 日期：2026-10-29

## 背景与问题

开发者会用 Cursor、Claude Code、Codex、Copilot、Gemini CLI 等不同工具。它们读取规则和技能的位置不同：

| 工具 | 规则文件 | 技能目录 |
| --- | --- | --- |
| Cursor、Codex、Copilot | `AGENTS.md`（逐级） | `.agents/skills/` |
| Gemini CLI | 默认 `GEMINI.md`，可配置 | `.agents/skills/` |
| Claude Code | `CLAUDE.md`（任意上级存在 `CLAUDE.md` 时不再读 `AGENTS.md`） | `.claude/skills/` |

目标是只维护一份内容，所有工具读到的规则和步骤完全一致。

## 决定

- **规则唯一来源是 `AGENTS.md`**：根目录一份（不超过 150 行，Codex 默认只读 32 KiB），
  `apps/loom`、`apps/web`、`packages/contracts` 各一份局部规则。细节放 `docs/` 与技能，按需加载。
- **Claude Code**：每个 `AGENTS.md` 旁生成一个只含 `@AGENTS.md` 的 `CLAUDE.md`。
- **Gemini CLI**：`.gemini/settings.json` 设置 `context.fileName: "AGENTS.md"`。
- **技能唯一来源是 `.agents/skills/`**；`scripts/harness-sync.ts` 把它复制成 `.claude/skills/` 的真实文件。
  不用符号链接，Windows 与部分 SDK 对符号链接支持不好。
- **`npm run harness:check`**（`harness-sync --check`）比较生成物与来源，不一致即失败，纳入 `npm run check` 与 CI。
- 生成物提交进仓库，克隆后不需要先运行脚本。

## 理由

- 一份内容、一个脚本、一个检查，任何工具改了来源都会在 CI 暴露漂移。
- 开发技能在功能实现后定稿，示例直接指向仓库里的真实文件，AI 可以照着改，而不是凭训练数据猜。

## 代价

- `.claude/skills/` 是重复内容；靠 `harness:check` 保证不手改。
- 新的 AI 工具出现时，需要在 `harness-sync.ts` 增加一种生成目标。
