import type { Artifacts, Citation, CitationCheck, ModuleDigest } from "@loom/contracts";

export type SourcedCitation = { source: string; citation: Citation };

/** 收集任意产物中名为 `citations` 的数组。新增分析无需改这里。 */
function walk(value: unknown, source: string, out: SourcedCitation[]): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, source, out);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "citations" && Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === "object" && typeof (c as Citation).path === "string") {
          out.push({ source, citation: { path: (c as Citation).path, line: (c as Citation).line ?? null } });
        }
      }
    } else {
      walk(child, source, out);
    }
  }
}

/** 同一来源对同一位置的多次引用（例如多条建议都引用 package.json）只核实、只统计一次。 */
export function collectCitations(artifacts: Artifacts, digests: readonly ModuleDigest[]): SourcedCitation[] {
  const out: SourcedCitation[] = [];
  for (const [id, artifact] of Object.entries(artifacts)) {
    if (artifact) walk(artifact, id, out);
  }
  for (const digest of digests) {
    for (const file of digest.keyFiles) {
      out.push({ source: `digest:${digest.module}`, citation: { path: file.path, line: null } });
    }
  }
  const seen = new Set<string>();
  return out.filter(({ source, citation }) => {
    const key = `${source}\0${normalizeCitationPath(citation.path)}\0${citation.line ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 把模型可能写出的 `/repo/x`、`./x`、`/x` 统一成仓库根相对路径。 */
export function normalizeCitationPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/?repo\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

/**
 * 核实引用：文件必须存在，行号不能越界。
 * @param lineCountOf 返回文件行数；文件不存在时返回 null
 */
export function verifyCitations(
  citations: readonly SourcedCitation[],
  lineCountOf: (path: string) => number | null,
): CitationCheck {
  const unverified: CitationCheck["unverified"] = [];
  for (const { source, citation } of citations) {
    const path = normalizeCitationPath(citation.path);
    const lines = lineCountOf(path);
    if (lines === null) {
      unverified.push({ source, path, line: citation.line, reason: "missing-file" });
    } else if (citation.line !== null && citation.line > lines) {
      unverified.push({ source, path, line: citation.line, reason: "line-out-of-range" });
    }
  }
  return { total: citations.length, verified: citations.length - unverified.length, unverified };
}
