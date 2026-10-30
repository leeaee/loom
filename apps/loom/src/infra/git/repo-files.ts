import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { simpleGit } from "simple-git";
import { normalizeCitationPath } from "../../domain/index";

/** 仓库内被 git 跟踪的文件（仓库根相对路径，`/` 分隔）。 */
export async function listRepoFiles(checkoutDir: string): Promise<string[]> {
  const output = await simpleGit({
    baseDir: checkoutDir,
    config: ["core.hooksPath=/dev/null"],
    unsafe: { allowUnsafeHooksPath: true },
  }).raw(["ls-files", "-z"]);
  return output.split("\0").filter(Boolean);
}

const MAX_COUNTED_BYTES = 5 * 1024 * 1024;

function countLines(path: string): number {
  const content = readFileSync(path, "utf8");
  if (content === "") return 0;
  const breaks = content.split("\n").length - 1;
  return content.endsWith("\n") ? breaks : breaks + 1;
}

/**
 * 返回一个按路径取行数的函数，供引用核实使用；文件不存在、越出仓库或不是普通文件时返回 null。
 * 结果按路径缓存，只读取被引用到的文件。
 */
export function createLineCounter(checkoutDir: string): (path: string) => number | null {
  const root = realpathSync(checkoutDir);
  const cache = new Map<string, number | null>();
  return (rawPath) => {
    const path = normalizeCitationPath(rawPath);
    if (cache.has(path)) return cache.get(path) ?? null;
    let lines: number | null = null;
    try {
      const abs = realpathSync(join(root, path));
      const rel = relative(root, abs);
      const inside = rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
      const info = inside ? statSync(abs) : null;
      if (info?.isFile()) lines = info.size > MAX_COUNTED_BYTES ? Number.MAX_SAFE_INTEGER : countLines(abs);
    } catch {
      lines = null;
    }
    cache.set(path, lines);
    return lines;
  };
}
