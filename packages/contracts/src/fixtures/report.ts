import { REPORT_SCHEMA_VERSION, type Report } from "../report";
import { fixtureArtifacts } from "./artifacts";

/** 一份完整、合法的报告，供前端开发与测试使用。 */
export const fixtureReport: Report = {
  schemaVersion: REPORT_SCHEMA_VERSION,
  runId: "fixture-run",
  createdAt: "2026-10-30T00:00:00.000Z",
  mode: "fake",
  model: null,
  repo: {
    url: "https://github.com/loom-fixtures/todo-api.git",
    host: "github.com",
    owner: "loom-fixtures",
    name: "todo-api",
    ref: null,
    sha: "0123456789abcdef0123456789abcdef01234567",
  },
  scout: {
    totalFiles: 42,
    sourceFiles: 18,
    languages: [
      { language: "TypeScript", files: 16 },
      { language: "Prisma", files: 1 },
      { language: "JSON", files: 1 },
    ],
    topLevelDirs: [
      { name: "src", sourceFiles: 16 },
      { name: "prisma", sourceFiles: 1 },
    ],
    manifests: ["package.json"],
    hasTsconfig: true,
    large: false,
  },
  digests: [],
  artifacts: fixtureArtifacts,
  errors: [],
  citationCheck: {
    total: 16,
    verified: 15,
    unverified: [{ source: "api-surface", path: "src/cli/import.ts", line: null, reason: "missing-file" }],
  },
};
