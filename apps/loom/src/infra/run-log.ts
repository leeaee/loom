import { randomUUID } from "node:crypto";
import { RUN_LOG_EVENT, type RunLogEntry, type RunLogLevel } from "@loom/contracts";
import type { IMastraLogger } from "@mastra/core/logger";
import { redactSecrets } from "../domain/index";
import { defaultRunStore, type RunStore } from "./fs/run-store";

/** 步骤执行参数里的 writer（ToolStream）只需要 write。 */
export type StepWriter = { write: (data: unknown) => Promise<void> };

export type RunLogger = {
  readonly step: string;
  info: (message: string) => Promise<void>;
  warn: (message: string) => Promise<void>;
  error: (message: string) => Promise<void>;
  /** 同一运行内换一个步骤名，例如模块摘要的 digest:<module> */
  child: (step: string) => RunLogger;
};

export type RunLoggerOptions = {
  runId: string;
  step: string;
  writer?: StepWriter | undefined;
  logger?: IMastraLogger | undefined;
  store?: RunStore;
};

/**
 * 一条日志同时去三处：事件流（前端实时显示）、runs/<runId>/logs.jsonl（刷新后恢复）、Mastra logger（服务端控制台）。
 * 任何一处失败都不影响分析本身。
 */
export function createRunLogger(options: RunLoggerOptions): RunLogger {
  const store = options.store ?? defaultRunStore();

  const emit = async (level: RunLogLevel, raw: string) => {
    const entry: RunLogEntry = {
      type: RUN_LOG_EVENT,
      id: randomUUID(),
      at: Date.now(),
      step: options.step,
      level,
      message: redactSecrets(raw),
    };
    const fields = { runId: options.runId, step: options.step };
    options.logger?.[level](entry.message, fields);
    await Promise.allSettled([options.writer?.write(entry), store.appendLog(entry, options.runId)]);
  };

  return {
    step: options.step,
    info: (message) => emit("info", message),
    warn: (message) => emit("warn", message),
    error: (message) => emit("error", message),
    child: (step) => createRunLogger({ ...options, store, step }),
  };
}
