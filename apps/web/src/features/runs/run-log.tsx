"use client";

import { analysisIds, type RunLogEntry, type RunLogLevel, stepGroupOf } from "@loom/contracts";
import { useEffect, useRef } from "react";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const clock = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const LEVEL_TONE: Record<RunLogLevel, string> = {
  info: "text-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

export function stepLabel(step: string): string {
  if ((analysisIds as readonly string[]).includes(step))
    return copy.analyses[step as keyof typeof copy.analyses];
  if (step.startsWith("digest:")) return `${copy.steps.digest} · ${step.slice("digest:".length)}`;
  const group = stepGroupOf(step);
  return group ? copy.steps[group] : step;
}

/** 距底部这么近时视为“在看最新”，新日志到达时自动滚到底。 */
const STICK_THRESHOLD_PX = 24;

export function RunLog({ entries, live }: { entries: RunLogEntry[]; live: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el || entries.length === 0 || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{live ? copy.run.connecting : copy.run.logsEmpty}</p>;
  }

  return (
    <ol
      ref={listRef}
      aria-label={copy.run.logs}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
      }}
      className="grid max-h-96 gap-1 overflow-y-auto rounded-md bg-muted/40 p-3 font-mono text-xs"
    >
      {entries.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-2">
          <time className="text-muted-foreground tabular-nums" dateTime={new Date(entry.at).toISOString()}>
            {clock.format(entry.at)}
          </time>
          <span className="whitespace-nowrap text-foreground/80">[{stepLabel(entry.step)}]</span>
          <span className={cn("break-words", LEVEL_TONE[entry.level])}>
            {entry.level === "info" ? null : `${copy.logLevel[entry.level]}：`}
            {entry.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
