#!/usr/bin/env node
// 只读扫描仓库源码，输出疑似接口定义的位置（每行一个 JSON）。无第三方依赖，不执行被扫描的代码。
// 用法：node skills/api-surface/scripts/find-routes.mjs <仓库目录>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  "coverage",
  "__pycache__",
  ".venv",
]);
const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".java",
  ".kt",
  ".rs",
  ".rb",
  ".php",
  ".cs",
  ".proto",
  ".graphql",
  ".gql",
]);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RESULTS = 500;

const PATTERNS = [
  ["http", /\b(?:app|router|server|api|route)\.(?:get|post|put|patch|delete|all|options|head)\s*\(\s*["'`]/i],
  [
    "http",
    /@(?:Get|Post|Put|Patch|Delete|All|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(/,
  ],
  ["http", /@(?:app|router|bp|blueprint)\.(?:route|get|post|put|patch|delete)\s*\(/],
  ["http", /\bexport\s+(?:async\s+)?(?:function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/],
  ["http", /\bhttp\.HandleFunc\s*\(|\.(?:GET|POST|PUT|PATCH|DELETE)\s*\(\s*"/],
  ["rpc", /^\s*service\s+\w+\s*\{|\b(?:publicProcedure|protectedProcedure|procedure)\b/],
  ["graphql", /^\s*(?:extend\s+)?type\s+(?:Query|Mutation|Subscription)\b|@(?:Query|Mutation|Resolver)\s*\(/],
  ["cli", /\.command\s*\(\s*["'`]|#\[command|cobra\.Command\s*\{|add_parser\s*\(/],
  [
    "event",
    /\.(?:subscribe|on|consume)\s*\(\s*["'`][\w.:/-]+["'`]|@(?:EventPattern|MessagePattern|KafkaListener|RabbitListener)\s*\(/,
  ],
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const hidden = entry.name.startsWith(".") && entry.name !== ".github";
      if (!hidden && !IGNORED_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile() && SOURCE_EXT.has(extname(entry.name))) {
      yield full;
    }
  }
}

const root = process.argv[2];
if (!root) {
  console.error("用法：node skills/api-surface/scripts/find-routes.mjs <仓库目录>");
  process.exit(2);
}

const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

let count = 0;
for (const file of walk(root)) {
  if (statSync(file).size > MAX_FILE_BYTES) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    const hit = PATTERNS.find(([, re]) => re.test(text));
    if (!hit) continue;
    emit({ path: relative(root, file), line: i + 1, kind: hit[0], text: text.trim().slice(0, 200) });
    count += 1;
    if (count >= MAX_RESULTS) {
      emit({ truncated: true, limit: MAX_RESULTS });
      process.exit(0);
    }
  }
}
