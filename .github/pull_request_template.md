## 做了什么

<!-- 一个 PR 只做一件事。说明动机与改动范围。 -->

## 检查项

- [ ] 本地 `npm run check` 全绿
- [ ] 提交信息符合 Conventional Commits，scope 为 `loom` / `web` / `contracts` / `harness` 等
- [ ] 修改了 `packages/contracts`：已更新夹具，并同步了 `apps/loom` 与 `apps/web`（见 `loom-change-contract` 技能）
- [ ] 新增分析模块：按 `loom-add-analysis` 技能补齐 contracts、运行时技能、Agent/步骤、注册表、Web 分区与测试
- [ ] 修改了 `.agents/skills`：已运行 `npm run harness:sync`
- [ ] 更新了相关文档（`AGENTS.md`、`docs/`、ADR）
- [ ] 没有提交 `.loom/`、`.env` 或密钥
