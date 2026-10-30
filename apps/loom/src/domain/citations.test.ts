import { fixtureArtifacts, fixtureDigest } from "@loom/contracts/fixtures";
import { describe, expect, it } from "vitest";
import { collectCitations, normalizeCitationPath, verifyCitations } from "./citations";

describe("citations", () => {
  it("collects citations from every artifact and digest key files", () => {
    const digest = { ...fixtureDigest("src"), keyFiles: [{ path: "src/index.ts", role: "入口" }] };
    const citations = collectCitations(fixtureArtifacts, [digest]);
    const sources = new Set(citations.map((c) => c.source));
    expect(sources).toEqual(
      new Set(["api-surface", "data-model", "architecture-flow", "tech-choice", "digest:src"]),
    );
  });

  it("counts repeated citations of the same location from one source once", () => {
    const keys = collectCitations(fixtureArtifacts, []).map(
      (c) => `${c.source}|${normalizeCitationPath(c.citation.path)}|${c.citation.line}`,
    );
    expect(keys.filter((k) => k === "tech-choice|package.json|null")).toHaveLength(1);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ["/repo/src/a.ts", "src/a.ts"],
    ["./src/a.ts", "src/a.ts"],
    ["/src/a.ts", "src/a.ts"],
    ["src\\a.ts", "src/a.ts"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCitationPath(input)).toBe(expected);
  });

  it("flags missing files and out-of-range lines", () => {
    const lines: Record<string, number> = { "src/a.ts": 10 };
    const check = verifyCitations(
      [
        { source: "x", citation: { path: "/repo/src/a.ts", line: 3 } },
        { source: "x", citation: { path: "src/a.ts", line: 11 } },
        { source: "x", citation: { path: "src/a.ts", line: null } },
        { source: "y", citation: { path: "src/missing.ts", line: 1 } },
      ],
      (path) => lines[path] ?? null,
    );
    expect(check.total).toBe(4);
    expect(check.verified).toBe(2);
    expect(check.unverified.map((u) => u.reason)).toEqual(["line-out-of-range", "missing-file"]);
  });
});
