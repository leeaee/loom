import { join, resolve } from "node:path";
import { z } from "zod";
import { findRepoRoot } from "./paths";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z
  .object({
    LOOM_AGENT_MODE: z.enum(["real", "fake"]).default("real"),
    LOOM_MODEL: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^[\w.-]+\/[\w.:-]+$/, "LOOM_MODEL 必须是 provider/model 格式，例如 openai/gpt-5.1")
        .optional(),
    ),
    LOOM_MODEL_URL: z.preprocess(
      emptyToUndefined,
      z
        .url({
          protocol: /^https?$/,
          error: "LOOM_MODEL_URL 必须是 http(s) 地址，例如 https://api.deepseek.com/v1",
        })
        .optional(),
    ),
    LOOM_MODEL_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    GITHUB_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
    LOOM_SPLIT_FILE_THRESHOLD: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(400),
    ),
    LOOM_MAX_STEPS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(100).default(12)),
    LOOM_FAKE_DELAY_MS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().nonnegative().max(60_000).default(0),
    ),
    LOOM_LOG_LEVEL: z.preprocess(
      emptyToUndefined,
      z.enum(["debug", "info", "warn", "error"]).default("info"),
    ),
    LOOM_DATA_DIR: z.preprocess(emptyToUndefined, z.string().optional()),
    LOOM_SKILLS_DIR: z.preprocess(emptyToUndefined, z.string().optional()),
    LOOM_ALLOW_LOCAL_REPOS: z.preprocess(emptyToUndefined, z.stringbool().default(false)),
  })
  .superRefine((env, ctx) => {
    if (env.LOOM_AGENT_MODE === "real" && !env.LOOM_MODEL) {
      ctx.addIssue({
        code: "custom",
        path: ["LOOM_MODEL"],
        message:
          "真实模式（LOOM_AGENT_MODE=real）必须设置 LOOM_MODEL；只想跑通流程时设置 LOOM_AGENT_MODE=fake",
      });
    }
  });

export type LoomConfig = {
  mode: "real" | "fake";
  model: string | null;
  /** OpenAI 兼容接口地址（/chat/completions 的上一级）；null 时用供应商默认地址 */
  modelUrl: string | null;
  /** 配合 modelUrl 使用的密钥；设置了 modelUrl 时 Mastra 不再读取 provider 的 *_API_KEY，只用这里的值 */
  modelApiKey: string | null;
  githubToken: string | null;
  splitFileThreshold: number;
  maxSteps: number;
  /** 假模式下每个 Agent 调用的模拟耗时，便于观察前端进度 */
  fakeDelayMs: number;
  /** 服务端控制台日志级别；运行日志（logs.jsonl 与前端）不受影响 */
  logLevel: "debug" | "info" | "warn" | "error";
  allowLocalRepos: boolean;
  paths: {
    repoRoot: string | null;
    dataDir: string;
    skillsDir: string;
    reposDir: string;
    runsDir: string;
    cacheDir: string;
    scratchDir: string;
    databaseUrl: string;
    /** mastra dev / CLI 读取的 .env 位置，用于提示用户去哪里改配置 */
    envFile: string;
  };
};

/** 写进报告与缓存键的模型标识：同一模型名换了接口地址，视为不同模型。 */
export function modelLabel(config: Pick<LoomConfig, "model" | "modelUrl">): string | null {
  if (!config.model) return null;
  return config.modelUrl ? `${config.model} @ ${config.modelUrl}` : config.model;
}

export function parseConfig(env: NodeJS.ProcessEnv): LoomConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Loom 配置无效：\n${details}`);
  }
  const e = parsed.data;
  const repoRoot = e.LOOM_DATA_DIR && e.LOOM_SKILLS_DIR ? null : findRepoRoot();
  const dataDir = resolve(e.LOOM_DATA_DIR ?? join(repoRoot ?? ".", ".loom"));
  const skillsDir = resolve(e.LOOM_SKILLS_DIR ?? join(repoRoot ?? ".", "apps", "loom", "skills"));

  return {
    mode: e.LOOM_AGENT_MODE,
    model: e.LOOM_MODEL ?? null,
    modelUrl: e.LOOM_MODEL_URL?.replace(/\/+$/, "") ?? null,
    modelApiKey: e.LOOM_MODEL_API_KEY ?? null,
    githubToken: e.GITHUB_TOKEN ?? null,
    splitFileThreshold: e.LOOM_SPLIT_FILE_THRESHOLD,
    maxSteps: e.LOOM_MAX_STEPS,
    fakeDelayMs: e.LOOM_FAKE_DELAY_MS,
    logLevel: e.LOOM_LOG_LEVEL,
    allowLocalRepos: e.LOOM_ALLOW_LOCAL_REPOS,
    paths: {
      repoRoot,
      dataDir,
      skillsDir,
      reposDir: join(dataDir, "repos"),
      runsDir: join(dataDir, "runs"),
      cacheDir: join(dataDir, "cache"),
      scratchDir: join(dataDir, "scratch"),
      databaseUrl: `file:${join(dataDir, "mastra.db")}`,
      envFile: repoRoot ? join(repoRoot, "apps", "loom", ".env") : resolve(".env"),
    },
  };
}

let cached: LoomConfig | undefined;

/** 进程级配置；首次调用时校验环境变量，失败即抛出带中文说明的错误。 */
export function loadConfig(): LoomConfig {
  cached ??= parseConfig(process.env);
  return cached;
}

/** 仅供测试：清除缓存，使下次 loadConfig 重新读取 process.env。 */
export function resetConfigForTests(): void {
  cached = undefined;
}
