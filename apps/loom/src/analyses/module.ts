import type { AnalysisId } from "@loom/contracts";
import type { Agent } from "@mastra/core/agent";
import type { AdviseStep, AnalyzeStep } from "./shared/create-step";

type ModuleBase<Id extends AnalysisId> = {
  id: Id;
  /** 中文标题，用于日志与 Studio */
  title: string;
  /** apps/loom/skills 下的技能目录名，与 id 一致 */
  skill: Id;
  agent: Agent;
};

/**
 * 分析模块：唯一的扩展点。新增分析时实现一个 AnalysisModule 并加入 registry.ts，
 * 工作流的并行段与顾问段都由注册表生成。
 */
export type AnalysisModule<Id extends AnalysisId = AnalysisId> =
  | (ModuleBase<Id> & { phase: "analyze"; step: AnalyzeStep })
  | (ModuleBase<Id> & { phase: "advise"; step: AdviseStep });
