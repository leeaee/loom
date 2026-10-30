import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * 从 start 向上查找仓库根（含 package-lock.json 与 packages/contracts 的目录）。
 * `mastra dev` 会在 .mastra/output 下运行打包产物，不能假设 cwd 就是 apps/loom。
 */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "package-lock.json")) && existsSync(join(dir, "packages", "contracts"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `找不到 Loom 仓库根目录（从 ${start} 向上没有 package-lock.json）。请设置 LOOM_DATA_DIR 与 LOOM_SKILLS_DIR。`,
      );
    }
    dir = parent;
  }
}
