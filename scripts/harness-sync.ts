/**
 * Harness 同步：以 `.agents/skills/` 与各级 `AGENTS.md` 为唯一来源，生成
 * - `.claude/skills/`：技能的真实文件副本（不用符号链接，Windows 与部分 SDK 不支持）；
 * - 每个 `AGENTS.md` 旁的 `CLAUDE.md`：只含 `@AGENTS.md`（上级有 CLAUDE.md 时 Claude Code 不再读 AGENTS.md）；
 * - `.gemini/settings.json`：让 Gemini CLI 读取 AGENTS.md。
 *
 * 用法：`npm run harness:sync` 写入；`npm run harness:check` 只比较，不一致时退出码为 1。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_SOURCE = ".agents/skills";
const SKILLS_TARGET = ".claude/skills";
const SKIPPED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".mastra",
  ".loom",
  "dist",
  "coverage",
  ".claude",
]);

const CLAUDE_MD = "@AGENTS.md\n";
const GEMINI_SETTINGS = `${JSON.stringify({ context: { fileName: "AGENTS.md" } }, null, 2)}\n`;

const toPosix = (path: string) => path.split(sep).join("/");

function walk(dir: string, visit: (relPath: string) => void, skip = SKIPPED_DIRS): void {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? join(dir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walk(rel, visit, skip);
    } else if (entry.isFile()) {
      visit(toPosix(rel));
    }
  }
}

function listFiles(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  const files: string[] = [];
  walk(dir, (rel) => files.push(rel), new Set());
  return files.sort();
}

/** 生成物：相对路径 → 期望内容。 */
function expectedOutputs(): Map<string, Buffer> {
  const outputs = new Map<string, Buffer>();

  for (const file of listFiles(SKILLS_SOURCE)) {
    const target = `${SKILLS_TARGET}/${relative(SKILLS_SOURCE, file).split(sep).join("/")}`;
    outputs.set(target, readFileSync(join(ROOT, file)));
  }

  walk("", (rel) => {
    if (rel === "AGENTS.md" || rel.endsWith("/AGENTS.md")) {
      outputs.set(rel.replace(/AGENTS\.md$/, "CLAUDE.md"), Buffer.from(CLAUDE_MD));
    }
  });

  outputs.set(".gemini/settings.json", Buffer.from(GEMINI_SETTINGS));
  return outputs;
}

type Drift = { path: string; kind: "missing" | "changed" | "extra" };

function findDrift(outputs: Map<string, Buffer>): Drift[] {
  const drift: Drift[] = [];
  for (const [path, content] of outputs) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) drift.push({ path, kind: "missing" });
    else if (!readFileSync(abs).equals(content)) drift.push({ path, kind: "changed" });
  }
  for (const path of listFiles(SKILLS_TARGET)) {
    if (!outputs.has(path)) drift.push({ path, kind: "extra" });
  }
  return drift;
}

function write(outputs: Map<string, Buffer>, drift: Drift[]): void {
  for (const { path, kind } of drift) {
    const abs = join(ROOT, path);
    if (kind === "extra") {
      rmSync(abs, { force: true });
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, outputs.get(path) ?? "");
  }
  removeEmptyDirs(join(ROOT, SKILLS_TARGET));
}

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name));
  }
  if (readdirSync(dir).length === 0 && dir !== join(ROOT, SKILLS_TARGET)) rmSync(dir, { recursive: true });
}

const LABEL: Record<Drift["kind"], string> = { missing: "缺失", changed: "内容不一致", extra: "多余" };

function main(argv: readonly string[]): number {
  const check = argv.includes("--check");
  const outputs = expectedOutputs();
  const drift = findDrift(outputs);

  if (check) {
    if (drift.length === 0) {
      console.info(`harness 已同步（${outputs.size} 个生成文件）`);
      return 0;
    }
    console.error("harness 未同步，请运行 npm run harness:sync 后提交生成的文件：");
    for (const { path, kind } of drift) console.error(`  - ${path}：${LABEL[kind]}`);
    return 1;
  }

  write(outputs, drift);
  console.info(
    drift.length === 0
      ? "harness 已是最新"
      : `harness 已同步：更新 ${drift.length} 个文件（共 ${outputs.size} 个生成文件）`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
