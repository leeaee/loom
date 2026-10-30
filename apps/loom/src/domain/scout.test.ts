import { describe, expect, it } from "vitest";
import { digestModules, ROOT_MODULE, scoutRepo } from "./scout";

const files = [
  "package.json",
  "tsconfig.json",
  "index.ts",
  "src/a.ts",
  "src/b.ts",
  "src/types.d.ts",
  "lib/c.py",
  "node_modules/x/index.js",
  "dist/bundle.min.js",
  "packages/core/package.json",
  "README.md",
];

describe("scoutRepo", () => {
  it("counts source files by language and top-level module, ignoring vendored and generated files", () => {
    const scout = scoutRepo(files, 400);
    expect(scout.totalFiles).toBe(files.length);
    expect(scout.sourceFiles).toBe(4);
    expect(scout.languages).toEqual([
      { language: "TypeScript", files: 3 },
      { language: "Python", files: 1 },
    ]);
    expect(scout.topLevelDirs).toEqual([
      { name: "src", sourceFiles: 2 },
      { name: ROOT_MODULE, sourceFiles: 1 },
      { name: "lib", sourceFiles: 1 },
    ]);
    expect(scout.manifests).toEqual(["package.json", "packages/core/package.json"]);
    expect(scout.hasTsconfig).toBe(true);
    expect(scout.large).toBe(false);
  });

  it("marks the repo large above the threshold and lists digest modules", () => {
    const scout = scoutRepo(files, 3);
    expect(scout.large).toBe(true);
    expect(digestModules(scout, 2)).toEqual(["src", ROOT_MODULE]);
  });
});
