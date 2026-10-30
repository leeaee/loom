import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LoomError, type ParsedRepoUrl, parseRepoUrl } from "../../src/domain/index";
import { createLineCounter, listRepoFiles, syncRepo } from "../../src/infra/index";
import { createSourceRepo, type SourceRepo, tempDir } from "../helpers/git-fixture";

describe("syncRepo", () => {
  let tmp: ReturnType<typeof tempDir>;
  let source: SourceRepo;
  let repo: ParsedRepoUrl;
  let reposDir: string;

  beforeEach(() => {
    tmp = tempDir("loom-sync-");
    source = createSourceRepo(join(tmp.path, "source"), {
      "README.md": "# demo\n",
      "src/index.ts": "export const a = 1;\nexport const b = 2;\n",
    });
    const parsed = parseRepoUrl(source.url);
    if (!parsed.ok) throw parsed.error;
    repo = parsed.value;
    reposDir = join(tmp.path, "repos");
  });
  afterEach(() => tmp.cleanup());

  it("clones, records the SHA and checks out a worktree per commit", async () => {
    const first = await syncRepo({ repo, ref: null, token: null, reposDir });
    expect(first.sha).toBe(source.head());
    expect(readFileSync(join(first.checkoutDir, "README.md"), "utf8")).toBe("# demo\n");

    const nextSha = source.commit({ "src/new.ts": "export {};\n" });
    const second = await syncRepo({ repo, ref: null, token: null, reposDir });
    expect(second.sha).toBe(nextSha);
    expect(second.checkoutDir).not.toBe(first.checkoutDir);
    expect(existsSync(join(first.checkoutDir, "src/new.ts"))).toBe(false);
    expect(existsSync(join(second.checkoutDir, "src/new.ts"))).toBe(true);
  });

  it("reuses the existing worktree when the SHA has not changed", async () => {
    const first = await syncRepo({ repo, ref: null, token: null, reposDir });
    writeFileSync(join(first.checkoutDir, "marker"), "keep");
    const again = await syncRepo({ repo, ref: null, token: null, reposDir });
    expect(again.checkoutDir).toBe(first.checkoutDir);
    expect(existsSync(join(again.checkoutDir, "marker"))).toBe(true);
  });

  it("checks out a named ref and reports missing refs", async () => {
    const featureSha = source.branch("feature", { "feature.ts": "export {};\n" });
    const feature = await syncRepo({ repo, ref: "feature", token: null, reposDir });
    expect(feature.sha).toBe(featureSha);

    await expect(syncRepo({ repo, ref: "does-not-exist", token: null, reposDir })).rejects.toSatisfy(
      (error: unknown) => error instanceof LoomError && error.code === "GIT_REF_NOT_FOUND",
    );
  });

  it("never runs git hooks", async () => {
    const first = await syncRepo({ repo, ref: null, token: null, reposDir });
    const marker = join(tmp.path, "hook-ran");
    const hooksDir = join(first.mirrorDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    for (const hook of ["post-checkout", "post-merge", "reference-transaction"]) {
      writeFileSync(join(hooksDir, hook), `#!/bin/sh\ntouch "${marker}"\n`);
      chmodSync(join(hooksDir, hook), 0o755);
    }
    source.commit({ "x.ts": "export {};\n" });
    await syncRepo({ repo, ref: null, token: null, reposDir });
    expect(existsSync(marker)).toBe(false);
  });

  it("serializes concurrent syncs of the same repository", async () => {
    const results = await Promise.all([
      syncRepo({ repo, ref: null, token: null, reposDir }),
      syncRepo({ repo, ref: null, token: null, reposDir }),
    ]);
    expect(results[0].sha).toBe(results[1].sha);
    expect(results[0].checkoutDir).toBe(results[1].checkoutDir);
  });

  it("lists tracked files and counts lines inside the checkout only", async () => {
    const { checkoutDir } = await syncRepo({ repo, ref: null, token: null, reposDir });
    expect((await listRepoFiles(checkoutDir)).sort()).toEqual(["README.md", "src/index.ts"]);
    const lines = createLineCounter(checkoutDir);
    expect(lines("src/index.ts")).toBe(2);
    expect(lines("missing.ts")).toBeNull();
    expect(lines("../source/README.md")).toBeNull();
  });
});
