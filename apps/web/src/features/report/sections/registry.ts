import type { AnalysisId } from "@loom/contracts";
import type { ComponentType } from "react";
import { ApiSurfaceSection } from "./api-surface";
import { ArchitectureFlowSection } from "./architecture-flow";
import { DataModelSection } from "./data-model";
import { TechChoiceSection } from "./tech-choice";
import type { SectionProps } from "./types";

/**
 * 报告分区注册表：每个 AnalysisId 必须有一个分区组件。
 * 在 contracts 新增分析 id 后，这里缺项会直接导致类型检查失败。
 */
export const reportSections = {
  "api-surface": ApiSurfaceSection,
  "data-model": DataModelSection,
  "architecture-flow": ArchitectureFlowSection,
  "tech-choice": TechChoiceSection,
} satisfies { [Id in AnalysisId]: ComponentType<SectionProps<Id>> };
