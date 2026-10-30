import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Loom Test",
  GIT_AUTHOR_EMAIL: "test@loom.local",
  GIT_COMMITTER_NAME: "Loom Test",
  GIT_COMMITTER_EMAIL: "test@loom.local",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
};

/** 本地源仓库夹具：用 file:// 地址充当远端，测试不访问网络。 */
export type SourceRepo = {
  dir: string;
  url: string;
  commit: (files: Record<string, string>, message?: string) => string;
  branch: (name: string, files: Record<string, string>) => string;
  head: () => string;
};

export function createSourceRepo(dir: string, files: Record<string, string>): SourceRepo {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, env: GIT_ENV, encoding: "utf8" }).trim();
  const write = (entries: Record<string, string>) => {
    for (const [path, content] of Object.entries(entries)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
  };
  mkdirSync(dir, { recursive: true });
  git("init", "--initial-branch=main", "--quiet");
  git("config", "uploadpack.allowFilter", "true");
  git("config", "uploadpack.allowAnySHA1InWant", "true");

  const repo: SourceRepo = {
    dir,
    url: `file://${dir}`,
    commit: (entries, message = "update") => {
      write(entries);
      git("add", "-A");
      git("commit", "--quiet", "-m", message);
      return git("rev-parse", "HEAD");
    },
    branch: (name, entries) => {
      git("checkout", "--quiet", "-b", name);
      const sha = repo.commit(entries, `branch ${name}`);
      git("checkout", "--quiet", "main");
      return sha;
    },
    head: () => git("rev-parse", "HEAD"),
  };
  repo.commit(files, "initial");
  return repo;
}

/** 创建临时目录，返回路径与清理函数。 */
export function tempDir(prefix: string): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}
