import type { RepoScout } from "@loom/contracts";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  scala: "Scala",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  fs: "F#",
  swift: "Swift",
  m: "Objective-C",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  hpp: "C++",
  dart: "Dart",
  ex: "Elixir",
  exs: "Elixir",
  erl: "Erlang",
  clj: "Clojure",
  lua: "Lua",
  sh: "Shell",
  vue: "Vue",
  svelte: "Svelte",
  sql: "SQL",
  prisma: "Prisma",
  graphql: "GraphQL",
  gql: "GraphQL",
  proto: "Protocol Buffers",
};

const MANIFEST_NAMES = new Set([
  "package.json",
  "deno.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  "Package.swift",
  "CMakeLists.txt",
  "Dockerfile",
  "docker-compose.yml",
  "compose.yaml",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "__pycache__",
  "third_party",
  ".git",
]);

const GENERATED = /(\.min\.(js|css)$)|(\.d\.ts$)|(\.generated\.\w+$)|(\.pb\.go$)/;

export const ROOT_MODULE = ".";

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function isIgnored(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_DIRS.has(segment));
}

export function languageOf(path: string): string | null {
  if (isIgnored(path) || GENERATED.test(path)) return null;
  return LANGUAGE_BY_EXTENSION[extensionOf(path)] ?? null;
}

/** 文件所属的顶层模块：第一级目录名，根目录文件归入 "."。 */
export function moduleOf(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? ROOT_MODULE : path.slice(0, slash);
}

/**
 * 只看文件清单得出仓库概况，不读文件内容、不调用模型。
 * @param files 仓库根的相对路径（`git ls-files` 的输出）
 */
export function scoutRepo(files: readonly string[], splitFileThreshold: number): RepoScout {
  const languages = new Map<string, number>();
  const modules = new Map<string, number>();
  const manifests: string[] = [];
  let sourceFiles = 0;
  let hasTsconfig = false;

  for (const file of files) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (!isIgnored(file)) {
      if (MANIFEST_NAMES.has(base)) manifests.push(file);
      if (/^tsconfig(\.[\w-]+)?\.json$/.test(base)) hasTsconfig = true;
    }
    const language = languageOf(file);
    if (!language) continue;
    sourceFiles += 1;
    languages.set(language, (languages.get(language) ?? 0) + 1);
    const module = moduleOf(file);
    modules.set(module, (modules.get(module) ?? 0) + 1);
  }

  const byCountDesc = <T extends { name: string; count: number }>(a: T, b: T) =>
    b.count - a.count || a.name.localeCompare(b.name);

  return {
    totalFiles: files.length,
    sourceFiles,
    languages: [...languages]
      .map(([name, count]) => ({ name, count }))
      .sort(byCountDesc)
      .map(({ name, count }) => ({ language: name, files: count })),
    topLevelDirs: [...modules]
      .map(([name, count]) => ({ name, count }))
      .sort(byCountDesc)
      .map(({ name, count }) => ({ name, sourceFiles: count })),
    manifests: manifests.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)),
    hasTsconfig,
    large: sourceFiles > splitFileThreshold,
  };
}

/** 大仓库需要做模块摘要的顶层目录，按源文件数降序，最多 limit 个。 */
export function digestModules(scout: RepoScout, limit = 24): string[] {
  return scout.topLevelDirs.slice(0, limit).map((dir) => dir.name);
}
