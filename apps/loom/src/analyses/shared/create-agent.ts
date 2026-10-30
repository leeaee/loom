import { Agent } from "@mastra/core/agent";
import type { OpenAICompatibleConfig } from "@mastra/core/llm";
import { type LoomConfig, loadConfig } from "../../config/index";
import { peekRunWorkspace, REPO_MOUNT, SKILLS_MOUNT } from "../../infra/index";

/** RequestContext 中存放当前运行 id 的键，Agent 据此解析本次运行的 Workspace。 */
export const RUN_ID_KEY = "loom.runId";
const FAKE_MODE_PLACEHOLDER_MODEL = "openai/gpt-5.1";

const BASE_INSTRUCTIONS = `你是 Loom 的代码理解助手，负责阅读一个 Git 仓库并产出结构化分析。

工作环境：
- 被分析的仓库只读挂载在 ${REPO_MOUNT}，运行时技能只读挂载在 ${SKILLS_MOUNT}。
- 用文件工具（list / read / grep）阅读代码；有 tsLanguage 工具时优先用它查符号、引用和调用关系。
- 绝不执行被分析仓库里的任何代码、脚本或构建命令。命令工具只能运行技能 scripts/ 目录下的脚本。

输出要求：
- 每条结论都要给出 citations：path 是仓库根的相对路径（不带 ${REPO_MOUNT}/ 前缀），line 是起始行号，整文件引用时 line 为 null。
- 只写读到的事实；不确定的内容不要编造，宁可少写。
- 说明性文字使用简体中文，代码标识符保持原样。
- 最终回复只包含一个符合 schema 的 JSON 对象本身：顶层直接是 summary 等字段，不要再以产物名（如 dataModel）为键包一层，不要加代码块或说明文字。`;

/**
 * 配置了 LOOM_MODEL_URL 时走 OpenAI 兼容接口（{url}/chat/completions），否则按 provider/model 走 Mastra 模型路由。
 * 真实模式下配置校验已保证 LOOM_MODEL 存在；假模式不调用模型，占位值只供 Studio 列出 Agent。
 */
export function resolveModel(
  config: Pick<LoomConfig, "model" | "modelUrl" | "modelApiKey">,
): string | OpenAICompatibleConfig {
  const id = (config.model ?? FAKE_MODE_PLACEHOLDER_MODEL) as `${string}/${string}`;
  if (!config.modelUrl) return id;
  return { id, url: config.modelUrl, ...(config.modelApiKey ? { apiKey: config.modelApiKey } : {}) };
}

export type AnalysisAgentOptions = {
  id: string;
  name: string;
  description: string;
  /** 运行时技能名（apps/loom/skills/<skill>） */
  skill: string;
  instructions: string;
};

/**
 * 分析 Agent 的统一构造：模型取自 LOOM_MODEL；Workspace 按 RequestContext 里的 runId 动态解析，
 * 因此同一个 Agent 实例可以注册到 Mastra（Studio 可见），又能在每次运行看到不同的仓库。
 */
export function createAnalysisAgent(options: AnalysisAgentOptions): Agent {
  return new Agent({
    id: options.id,
    name: options.name,
    description: options.description,
    instructions: [
      BASE_INSTRUCTIONS,
      `开始前先调用 skill 工具加载 \`${options.skill}\` 技能，按其中的步骤与检查清单执行。`,
      options.instructions,
    ].join("\n\n"),
    model: () => resolveModel(loadConfig()),
    workspace: ({ requestContext }) => peekRunWorkspace(requestContext.get(RUN_ID_KEY) as string | undefined),
  });
}
