import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { RUN_LOG_EVENT } from "@loom/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { summarizeToolArgs } from "../../src/analyses/shared/run-agent";
import { createRunLogger, RunStore } from "../../src/infra/index";
import { tempDir } from "../helpers/git-fixture";

describe("run logger", () => {
  let tmp: ReturnType<typeof tempDir>;
  let store: RunStore;

  beforeEach(() => {
    tmp = tempDir("loom-log-");
    store = new RunStore({ runsDir: join(tmp.path, "runs"), cacheDir: join(tmp.path, "cache") });
  });
  afterEach(() => tmp.cleanup());

  it("streams each entry to the step writer and persists it for later restore", async () => {
    const written: unknown[] = [];
    const log = createRunLogger({
      runId: "run-1",
      step: "sync-repo",
      store,
      writer: { write: async (data) => void written.push(data) },
    });
    await log.info("同步 https://x-access-token:ghp_secret123456789012345678901234567890@github.com/a/b");
    await log.child("render").warn("报告含错误");

    const entries = await store.readLogs("run-1");
    expect(written).toEqual(entries);
    expect(entries.map((e) => [e.type, e.step, e.level])).toEqual([
      [RUN_LOG_EVENT, "sync-repo", "info"],
      [RUN_LOG_EVENT, "render", "warn"],
    ]);
    expect(entries[0]?.message).not.toContain("ghp_secret");
  });

  it("keeps logging when the stream writer fails", async () => {
    const log = createRunLogger({
      runId: "run-2",
      step: "scout-repo",
      store,
      writer: { write: () => Promise.reject(new Error("stream closed")) },
    });
    await log.error("扫描失败");
    expect(await store.readLogs("run-2")).toHaveLength(1);
  });

  it("skips half-written lines and returns nothing for unknown runs", async () => {
    await createRunLogger({ runId: "run-3", step: "render", store }).info("ok");
    await appendFile(store.reportPaths("run-3").logs, '{"type":"loom-log","id":', "utf8");
    expect(await store.readLogs("run-3")).toHaveLength(1);
    expect(await store.readLogs("missing")).toEqual([]);
  });
});

describe("summarizeToolArgs", () => {
  it("prefers well-known argument keys and truncates long values", () => {
    expect(summarizeToolArgs({ path: "src/a.ts", other: { deep: true } })).toBe("path=src/a.ts");
    expect(summarizeToolArgs({ foo: 1 })).toBe('{"foo":1}');
    expect(summarizeToolArgs({ query: "x".repeat(300) })).toHaveLength(160);
    expect(summarizeToolArgs(undefined)).toBe("");
  });
});
