# Loom

代码理解 Agent：给它一个 Git 仓库，它会同步代码，按 `SKILL.md` 技能分析，产出一份带引用核实的报告：

- **API 接口清单**：HTTP 路由、RPC、GraphQL、CLI、库导出、事件
- **数据结构**：实体、字段、关系
- **架构与流程**：组件关系、关键流程，附 Mermaid 图
- **技术选型建议**：现状评估与替代方案，每条判断带仓库内路径

基于 [Mastra](https://mastra.ai)（Agent、工作流、技能、沙箱、MCP）与 Next.js 16。

## 快速开始

需要 Node 24（见 `.nvmrc`）和 npm 12、系统 git。

```bash
npm ci
cp .env.example apps/loom/.env    # 默认假模式，不需要模型密钥
npm run dev                       # Mastra Studio http://localhost:4111，Web http://localhost:3000
```

打开 <http://localhost:3000>，输入 `vercel/ms` 或任意公开仓库地址即可。假模式下 git 同步与扫描真实执行，
分析结果来自内置夹具，用来跑通流程和开发界面。

### 真实模式

在 `apps/loom/.env` 中设置：

```bash
LOOM_AGENT_MODE=real
LOOM_MODEL=openai/gpt-5.1          # Mastra 的 provider/model 字符串
OPENAI_API_KEY=...                 # 对应供应商的密钥
GITHUB_TOKEN=...                   # 可选：私有仓库与 GitHub MCP
```

### 命令行

```bash
npm run cli -w @loom/server -- analyze https://github.com/vercel/ms
npm run cli -w @loom/server -- analyze owner/repo --ref v2.0.0 --force
```

报告写在 `.loom/runs/<runId>/report.{json,md}`。同一提交、同一技能版本的分析会命中缓存。

### 作为 MCP 服务

`npm run dev` 后，Loom 在 `http://localhost:4111/api/mcp/loom/mcp` 暴露 `analyzeRepo` 工作流与 `getReport` 工具，
可以在 Cursor 等 MCP 客户端中添加这个地址。

## 开发

```bash
npm run check                      # lint + typecheck + 分层检查 + 测试 + harness 检查，合并前必须全绿
npm test -- --project loom         # 只跑某个包（loom / web / contracts）
npm run format
```

| 文档 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 所有开发者与 AI 工具共同遵守的规范（必读） |
| [docs/architecture.md](docs/architecture.md) | 架构、分层、工作流、沙箱与 MCP |
| [docs/conventions.md](docs/conventions.md) | 命名、错误处理、日志、测试、提交规范 |
| [docs/adr/](docs/adr/) | 重大选型记录 |
| [.agents/skills/](.agents/skills/) | 开发技能：新增分析、写运行时技能、加工具或 MCP、加界面、改合同、验证 |

## 许可证

见 [LICENSE](LICENSE)。
