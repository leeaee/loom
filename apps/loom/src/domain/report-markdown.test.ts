import { fixtureReport } from "@loom/contracts/fixtures";
import { describe, expect, it } from "vitest";
import { type CacheKeyInput, computeCacheKey } from "./cache-key";
import { redactSecrets } from "./errors";
import { renderReportMarkdown } from "./report-markdown";

describe("renderReportMarkdown", () => {
  it("renders a section per analysis plus the mermaid block", () => {
    const md = renderReportMarkdown(fixtureReport);
    expect(md).toContain(`# ${fixtureReport.repo.owner}/${fixtureReport.repo.name}`);
    for (const heading of ["## API", "## 数据结构", "## 架构", "## 技术选型"]) expect(md).toContain(heading);
    expect(md).toContain("```mermaid");
  });
});

describe("computeCacheKey", () => {
  const base: CacheKeyInput = {
    url: "https://github.com/a/b.git",
    sha: "a".repeat(40),
    skillsHash: "s",
    mode: "real",
    model: "m",
  };

  it("is stable and changes with every input", () => {
    const key = computeCacheKey(base);
    expect(computeCacheKey({ ...base })).toBe(key);
    expect(computeCacheKey({ ...base, sha: "b".repeat(40) })).not.toBe(key);
    expect(computeCacheKey({ ...base, skillsHash: "t" })).not.toBe(key);
    expect(computeCacheKey({ ...base, model: null })).not.toBe(key);
  });
});

describe("redactSecrets", () => {
  it("removes tokens, auth headers and url credentials", () => {
    const text = [
      "Authorization: Basic eC1hY2Nlc3MtdG9rZW46c2VjcmV0",
      "token ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnop",
      "https://user:pass@github.com/a/b.git",
    ].join("\n");
    const redacted = redactSecrets(text);
    expect(redacted).not.toMatch(/eC1hY2Nlc3MtdG9rZW46c2VjcmV0|ghp_abc|github_pat_11|user:pass/);
  });
});
