import { describe, expect, it } from "vitest";
import { filterToolsets, openRunToolsets, TS_LANGUAGE_TOOLS } from "../../src/infra/index";

describe("filterToolsets", () => {
  it("keeps only allowlisted tools for listed servers", () => {
    const tools = { get_symbols: {}, rename_symbol: {}, get_outline: {} };
    const filtered = filterToolsets({ tsLanguage: tools });
    expect(Object.keys(filtered.tsLanguage ?? {}).sort()).toEqual(["get_outline", "get_symbols"]);
    expect(TS_LANGUAGE_TOOLS).not.toContain("rename_symbol");
  });

  it("passes through servers without an allowlist", () => {
    const github = { get_file_contents: {}, search_code: {} };
    expect(filterToolsets({ github })).toEqual({ github });
  });
});

describe("openRunToolsets", () => {
  it("connects nothing when there is no token and no tsconfig", async () => {
    const result = await openRunToolsets({
      runId: "r",
      checkoutDir: "/tmp",
      repoHost: "github.com",
      hasTsconfig: false,
      githubToken: null,
      resolveFrom: [],
    });
    expect(result.toolsets).toEqual({});
    expect(result.connected).toEqual([]);
  });
});
