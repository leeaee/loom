import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { type SimpleGit, simpleGit } from "simple-git";
import { LoomError, type ParsedRepoUrl, redactSecrets } from "../../domain/index";
import { withFileLock } from "../fs/file-lock";

export type SyncRepoInput = {
  repo: ParsedRepoUrl;
  /** 分支、标签或完整 SHA；null 表示远端默认分支 */
  ref: string | null;
  /** 只对 github.com 生效，通过 http.extraHeader 注入 */
  token: string | null;
  reposDir: string;
};

export type SyncRepoResult = {
  sha: string;
  /** 只读使用的工作区，每个 SHA 一份，不会被其他运行改动 */
  checkoutDir: string;
  mirrorDir: string;
};

const SHA = /^[0-9a-f]{40}$/;

/** 每次 git 调用都带的安全配置：禁用 hooks、不递归子模块、不跳转协议。 */
const SAFE_CONFIG = [
  "core.hooksPath=/dev/null",
  "submodule.recurse=false",
  "protocol.ext.allow=never",
  "advice.detachedHead=false",
  "core.fsmonitor=false",
];

function gitEnv(repo: ParsedRepoUrl, token: string | null): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    GIT_TERMINAL_PROMPT: "0",
    GIT_LFS_SKIP_SMUDGE: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GCM_INTERACTIVE: "never",
  };
  if (token && repo.host === "github.com") {
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraHeader";
    env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basic}`;
  }
  return env;
}

function git(baseDir: string, repo: ParsedRepoUrl, token: string | null): SimpleGit {
  const env = gitEnv(repo, token);
  return simpleGit({
    baseDir,
    config: SAFE_CONFIG,
    allowEnvironment: Object.keys(env),
    timeout: { block: 5 * 60_000 },
    // 这些“不安全”开关只用于放行上面的加固配置与令牌注入，不接受任何外部输入。
    unsafe: {
      allowUnsafeHooksPath: true,
      allowUnsafeConfigEnvCount: true,
      allowUnsafeProtocolOverride: true,
      allowUnsafeFsMonitor: true,
    },
  }).env(env);
}

function wrap(
  error: unknown,
  action: string,
  code: "GIT_FAILED" | "GIT_REF_NOT_FOUND" = "GIT_FAILED",
): LoomError {
  const message = redactSecrets(error instanceof Error ? error.message : String(error)).trim();
  return new LoomError(code, `${action}失败：${message.split("\n").slice(-3).join(" ")}`, { cause: error });
}

export function repoCachePaths(reposDir: string, repo: ParsedRepoUrl) {
  const base = join(reposDir, repo.host, ...repo.owner.split("/"), repo.name);
  return {
    mirrorDir: join(base, "mirror"),
    checkoutsDir: join(base, "checkouts"),
    lockPath: join(base, "sync.lock"),
  };
}

/**
 * 同步远端仓库到本地缓存并检出指定提交：
 * 首次 `clone --filter=blob:none --no-tags --single-branch --depth 1 --no-checkout`；
 * 每次 `fetch --depth 1 origin <ref>`，再为解析出的 SHA 建一个独立 worktree。
 * 同一仓库的同步由文件锁串行化。
 */
export async function syncRepo(input: SyncRepoInput): Promise<SyncRepoResult> {
  const { repo, ref, token } = input;
  const { mirrorDir, checkoutsDir, lockPath } = repoCachePaths(input.reposDir, repo);

  return withFileLock(lockPath, async () => {
    if (!existsSync(join(mirrorDir, ".git"))) {
      await rm(mirrorDir, { recursive: true, force: true });
      await mkdir(mirrorDir, { recursive: true });
      try {
        await git(mirrorDir, repo, token).clone(repo.url, mirrorDir, [
          "--filter=blob:none",
          "--no-tags",
          "--single-branch",
          "--depth",
          "1",
          "--no-checkout",
        ]);
      } catch (error) {
        await rm(mirrorDir, { recursive: true, force: true });
        throw wrap(error, "克隆仓库");
      }
    }

    const mirror = git(mirrorDir, repo, token);
    try {
      await mirror.fetch(["--depth", "1", "--no-tags", "--filter=blob:none", "origin", ref ?? "HEAD"]);
    } catch (error) {
      const notFound = /couldn't find remote ref|not our ref|unadvertised object/i.test(String(error));
      throw wrap(error, `拉取 ${ref ?? "默认分支"} `, notFound ? "GIT_REF_NOT_FOUND" : "GIT_FAILED");
    }
    const sha = (await mirror.revparse(["FETCH_HEAD"])).trim();
    if (!SHA.test(sha)) throw new LoomError("GIT_FAILED", `无法解析提交 SHA：${sha}`);

    const checkoutDir = join(checkoutsDir, sha);
    if (!existsSync(join(checkoutDir, ".git"))) {
      await mirror.raw(["worktree", "prune"]);
      await rm(checkoutDir, { recursive: true, force: true });
      await mkdir(checkoutsDir, { recursive: true });
      try {
        await mirror.raw(["worktree", "add", "--detach", "--force", checkoutDir, sha]);
      } catch (error) {
        await rm(checkoutDir, { recursive: true, force: true });
        throw wrap(error, "检出提交");
      }
    }
    return { sha, checkoutDir, mirrorDir };
  });
}
