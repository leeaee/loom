import type { Artifacts, ModuleDigest } from "@loom/contracts";
import type { RunContext } from "../types";

const MAX_CONTEXT_CHARS = 40_000;

function truncate(text: string, max = MAX_CONTEXT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n…（已截断）` : text;
}

/** 所有分析共享的仓库概况段落。 */
export function repoContext(ctx: RunContext, digests: readonly ModuleDigest[]): string {
  const { repo, scout } = ctx;
  const lines = [
    `仓库：${repo.owner}/${repo.name}（${repo.url}）`,
    `提交：${repo.sha}${repo.ref ? `，ref ${repo.ref}` : ""}`,
    `文件 ${scout.totalFiles} 个，源文件 ${scout.sourceFiles} 个。`,
    `语言：${scout.languages.map((l) => `${l.language}(${l.files})`).join("、") || "未识别"}`,
    `顶层目录：${scout.topLevelDirs.map((d) => `${d.name}(${d.sourceFiles})`).join("、") || "无"}`,
    `清单文件：${scout.manifests.slice(0, 30).join("、") || "无"}`,
  ];
  if (digests.length) {
    lines.push("", "模块摘要（大仓库预处理结果，用来决定先读哪里）：");
    for (const d of digests) {
      lines.push(`- ${d.module}：${d.summary} 关键文件：${d.keyFiles.map((f) => f.path).join("、") || "无"}`);
    }
  }
  return truncate(lines.join("\n"));
}

/** 顾问阶段用：把已有产物压缩成 JSON 供参考。 */
export function artifactsContext(artifacts: Artifacts): string {
  return truncate(JSON.stringify(artifacts));
}
