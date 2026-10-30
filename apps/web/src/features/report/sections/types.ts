import type { AnalysisId, ArtifactOf } from "@loom/contracts";

/** 每个报告分区接收自己那一项分析的产物（已通过 contracts 校验）。 */
export type SectionProps<Id extends AnalysisId> = { artifact: ArtifactOf<Id> };
