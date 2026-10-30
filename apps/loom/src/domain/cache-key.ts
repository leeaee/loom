import { createHash } from "node:crypto";

export type HashEntry = { path: string; content: string | Uint8Array };

/** 对一组文件内容做稳定哈希（与读取顺序无关）。用于技能目录哈希。 */
export function hashEntries(entries: readonly HashEntry[]): string {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(entry.content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export type CacheKeyInput = {
  url: string;
  sha: string;
  skillsHash: string;
  mode: "real" | "fake";
  model: string | null;
};

/** 结果缓存键：URL + 提交 SHA + 技能目录哈希；模式和模型不同的结果互不复用。 */
export function computeCacheKey(input: CacheKeyInput): string {
  return createHash("sha256")
    .update(JSON.stringify([input.url, input.sha, input.skillsHash, input.mode, input.model ?? ""]))
    .digest("hex")
    .slice(0, 32);
}
