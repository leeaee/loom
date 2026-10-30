"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { fetchRunLogs } from "@/lib/api";
import { analyzeWorkflow } from "@/lib/mastra";
import {
  deriveOutcome,
  deriveTimeline,
  initialRunState,
  isTerminal,
  type RunAction,
  type RunEvent,
  type RunSnapshot,
  runReducer,
  runTiming,
  toRunStatus,
} from "./run-state";

const SNAPSHOT_FIELDS = ["result", "error", "payload", "steps"];
const POLL_INTERVAL_MS = 2000;

export class RunNotFoundError extends Error {}

async function loadSnapshot(runId: string): Promise<RunSnapshot> {
  // 刚提交的运行可能还没落库，短暂重试。
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await analyzeWorkflow().runById(runId, {
        fields: SNAPSHOT_FIELDS,
        withNestedWorkflows: false,
      })) as RunSnapshot;
    } catch (error) {
      if (attempt >= 3) {
        throw /404/.test(String(error)) ? new RunNotFoundError(runId) : error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

/**
 * 订阅一次分析运行：先取快照与已落盘的日志（刷新页面也能恢复），未结束则订阅事件流。
 * 事件流只在运行由 `stream` 启动时存在；流提前结束而运行未完成时（例如从 Studio 用 start 启动、
 * 服务重启），改为定时轮询快照与日志，直到运行结束。
 */
export function useAnalysisRun(runId: string) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [notFound, setNotFound] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    let disposed = false;
    let reader: ReadableStreamDefaultReader<RunEvent> | undefined;
    const send = (action: RunAction) => {
      if (!disposed) dispatch(action);
    };
    const refresh = async () => {
      const [snapshot, entries] = await Promise.all([
        loadSnapshot(runId),
        fetchRunLogs(runId).catch(() => []),
      ]);
      send({ type: "snapshot", snapshot });
      send({ type: "logs", entries });
      return isTerminal(toRunStatus(snapshot.status));
    };

    (async () => {
      try {
        if (await refresh()) return;

        const run = await analyzeWorkflow().createRun({ runId });
        const stream = (await run.observe()) as ReadableStream<RunEvent>;
        reader = stream.getReader();
        while (!disposed) {
          const { done, value } = await reader.read();
          if (done) break;
          send({ type: "event", event: value });
        }
        while (!disposed && !(await refresh())) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (error) {
        if (disposed) return;
        if (error instanceof RunNotFoundError) setNotFound(true);
        else send({ type: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    })();

    return () => {
      disposed = true;
      reader?.cancel().catch(() => undefined);
    };
  }, [runId]);

  const cancel = useCallback(async () => {
    setCanceling(true);
    try {
      const run = await analyzeWorkflow().createRun({ runId });
      await run.cancel();
    } finally {
      setCanceling(false);
    }
  }, [runId]);

  const timeline = useMemo(() => deriveTimeline(state), [state]);
  const outcome = useMemo(() => deriveOutcome(state, timeline), [state, timeline]);
  const timing = useMemo(() => runTiming(state), [state]);
  return { state, timeline, outcome, timing, notFound, cancel, canceling };
}
