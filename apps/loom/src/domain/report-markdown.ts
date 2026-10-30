import type {
  AnalysisId,
  ApiCatalog,
  Architecture,
  ArtifactOf,
  Citation,
  DataModel,
  Report,
  TechChoice,
} from "@loom/contracts";
import { analysisIds } from "@loom/contracts";

const cell = (text: string | null | undefined) => (text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const cite = (citations: readonly Citation[]) =>
  citations.map((c) => `\`${c.path}${c.line ? `:${c.line}` : ""}\``).join(", ");

function apiSection(a: ApiCatalog): string[] {
  return [
    a.summary,
    "",
    "| 类型 | 方法 | 名称 | 说明 | 位置 |",
    "| --- | --- | --- | --- | --- |",
    ...a.entries.map(
      (e) =>
        `| ${e.kind} | ${cell(e.method)} | \`${cell(e.name)}\` | ${cell(e.description)} | ${cite(e.citations)} |`,
    ),
  ];
}

function dataSection(d: DataModel): string[] {
  const lines = [d.summary, ""];
  for (const entity of d.entities) {
    lines.push(
      `### ${entity.name}（${entity.kind}）`,
      "",
      entity.description,
      "",
      `位置：${cite(entity.citations)}`,
      "",
    );
    if (entity.fields.length) {
      lines.push("| 字段 | 类型 | 可选 | 说明 |", "| --- | --- | --- | --- |");
      for (const f of entity.fields) {
        lines.push(
          `| ${cell(f.name)} | \`${cell(f.type)}\` | ${f.optional ? "是" : ""} | ${cell(f.description)} |`,
        );
      }
      lines.push("");
    }
    for (const r of entity.relations)
      lines.push(`- ${r.kind} → ${r.target}${r.description ? `：${r.description}` : ""}`);
    if (entity.relations.length) lines.push("");
  }
  return lines;
}

function architectureSection(a: Architecture): string[] {
  const lines = [a.summary, "", "```mermaid", a.mermaid, "```", "", "### 组件", ""];
  for (const c of a.components)
    lines.push(`- **${c.name}**（${c.kind}）：${c.responsibility} ${cite(c.citations)}`);
  if (a.flows.length) lines.push("", "### 关键流程", "");
  for (const f of a.flows) {
    lines.push(
      `**${f.name}**`,
      "",
      ...f.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      `位置：${cite(f.citations)}`,
      "",
    );
  }
  return lines;
}

function techSection(t: TechChoice): string[] {
  const lines = [t.summary, "", "### 现状", ""];
  for (const c of t.current)
    lines.push(`- **${c.category}**：${c.choice}。${c.assessment} ${cite(c.citations)}`);
  lines.push("", "### 建议", "");
  for (const r of t.recommendations) {
    lines.push(
      `#### ${r.category}：${r.recommendation}（置信度 ${r.confidence}）`,
      "",
      r.rationale,
      "",
      ...r.alternatives.map((alt) => `- 备选 ${alt.name}：${alt.tradeoff}`),
      "",
      `依据：${cite(r.citations)}`,
      "",
    );
  }
  return lines;
}

const sectionRenderers: { [Id in AnalysisId]: { title: string; render: (a: ArtifactOf<Id>) => string[] } } = {
  "api-surface": { title: "API", render: apiSection },
  "data-model": { title: "数据结构", render: dataSection },
  "architecture-flow": { title: "架构与流程", render: architectureSection },
  "tech-choice": { title: "技术选型", render: techSection },
};

function renderSection<Id extends AnalysisId>(id: Id, artifact: ArtifactOf<Id> | undefined): string[] {
  const { title, render } = sectionRenderers[id];
  return [`## ${title}`, "", ...(artifact ? render(artifact) : ["_本项分析未产出结果，见文末错误。_"]), ""];
}

/** 由 report.json 渲染 report.md。 */
export function renderReportMarkdown(report: Report): string {
  const { repo, scout, citationCheck } = report;
  const lines: string[] = [
    `# ${repo.owner}/${repo.name} 代码分析报告`,
    "",
    `- 仓库：${repo.url}`,
    `- 提交：\`${repo.sha}\`${repo.ref ? `（${repo.ref}）` : ""}`,
    `- 生成时间：${report.createdAt}`,
    `- 模式：${report.mode}${report.model ? `（${report.model}）` : ""}`,
    `- 文件：${scout.totalFiles}，源文件：${scout.sourceFiles}`,
    `- 语言：${scout.languages.map((l) => `${l.language} ${l.files}`).join("、") || "未识别"}`,
    `- 引用核实：${citationCheck.verified}/${citationCheck.total}`,
    "",
  ];

  if (report.digests.length) {
    lines.push("## 模块摘要", "");
    for (const d of report.digests) lines.push(`- **${d.module}**：${d.summary}`);
    lines.push("");
  }

  for (const id of analysisIds) lines.push(...renderSection(id, report.artifacts[id] as never));

  if (citationCheck.unverified.length) {
    lines.push("## 未核实的引用", "");
    for (const u of citationCheck.unverified) {
      lines.push(`- \`${u.path}${u.line ? `:${u.line}` : ""}\`（${u.source}，${u.reason}）`);
    }
    lines.push("");
  }
  if (report.errors.length) {
    lines.push("## 错误", "");
    for (const e of report.errors) lines.push(`- ${e.step}：${e.code} ${e.message}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
