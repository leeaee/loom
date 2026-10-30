import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type Report, type RunLogEntry, reportSchema, runLogEntrySchema } from "@loom/contracts";
import { z } from "zod";
import { loadConfig } from "../../config/index";
import { LoomError } from "../../domain/index";

const RUN_ID = /^[A-Za-z0-9_-]{1,128}$/;

function assertRunId(runId: string): void {
  if (!RUN_ID.test(runId)) throw new LoomError("REPORT_NOT_FOUND", `非法的 runId：${runId}`);
}

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

const cacheEntrySchema = z.object({ runId: z.string(), createdAt: z.string() });

/** 运行产物与结果缓存的读写：`<runsDir>/<runId>/report.{json,md}`、`<cacheDir>/<key>.json`。 */
export class RunStore {
  constructor(private readonly dirs: { runsDir: string; cacheDir: string }) {}

  reportPaths(runId: string) {
    assertRunId(runId);
    const dir = join(this.dirs.runsDir, runId);
    return {
      dir,
      json: join(dir, "report.json"),
      markdown: join(dir, "report.md"),
      logs: join(dir, "logs.jsonl"),
    };
  }

  /** 并行步骤会同时追加；单行远小于 PIPE_BUF，O_APPEND 写入不会交错。 */
  async appendLog(entry: RunLogEntry, runId: string): Promise<void> {
    const { dir, logs } = this.reportPaths(runId);
    await mkdir(dir, { recursive: true });
    await appendFile(logs, `${JSON.stringify(entry)}\n`, "utf8");
  }

  /** 按时间排序的运行日志；没有日志文件时返回空数组，损坏的行跳过。 */
  async readLogs(runId: string): Promise<RunLogEntry[]> {
    const { logs } = this.reportPaths(runId);
    if (!existsSync(logs)) return [];
    const entries: RunLogEntry[] = [];
    for (const line of (await readFile(logs, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = runLogEntrySchema.safeParse(JSON.parse(line));
        if (parsed.success) entries.push(parsed.data);
      } catch {
        // 进程中断时最后一行可能只写了一半
      }
    }
    return entries.sort((a, b) => a.at - b.at);
  }

  async writeReport(report: Report, markdown: string): Promise<string> {
    const paths = this.reportPaths(report.runId);
    await writeAtomic(paths.json, `${JSON.stringify(report, null, 2)}\n`);
    await writeAtomic(paths.markdown, markdown);
    return paths.json;
  }

  hasReport(runId: string): boolean {
    return RUN_ID.test(runId) && existsSync(this.reportPaths(runId).json);
  }

  async readReport(runId: string): Promise<Report> {
    const { json } = this.reportPaths(runId);
    if (!existsSync(json)) throw new LoomError("REPORT_NOT_FOUND", `运行 ${runId} 没有报告`);
    return reportSchema.parse(JSON.parse(await readFile(json, "utf8")));
  }

  async readMarkdown(runId: string): Promise<string> {
    const { markdown } = this.reportPaths(runId);
    if (!existsSync(markdown)) throw new LoomError("REPORT_NOT_FOUND", `运行 ${runId} 没有报告`);
    return readFile(markdown, "utf8");
  }

  /** 命中缓存时返回上次报告所属的 runId；报告文件已被删除则视为未命中。 */
  async findCached(cacheKey: string): Promise<string | null> {
    const path = join(this.dirs.cacheDir, `${cacheKey}.json`);
    if (!existsSync(path)) return null;
    const entry = cacheEntrySchema.safeParse(JSON.parse(await readFile(path, "utf8")));
    return entry.success && this.hasReport(entry.data.runId) ? entry.data.runId : null;
  }

  async recordCache(cacheKey: string, runId: string): Promise<void> {
    await writeAtomic(
      join(this.dirs.cacheDir, `${cacheKey}.json`),
      JSON.stringify({ runId, createdAt: new Date().toISOString() }),
    );
  }
}

let defaultStore: RunStore | undefined;

/** 进程级的运行存储，目录取自配置。 */
export function defaultRunStore(): RunStore {
  if (!defaultStore) {
    const { paths } = loadConfig();
    defaultStore = new RunStore({ runsDir: paths.runsDir, cacheDir: paths.cacheDir });
  }
  return defaultStore;
}
