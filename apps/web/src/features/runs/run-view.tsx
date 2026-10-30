"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportView } from "@/features/report";
import { copy } from "@/lib/copy";
import { RunLog } from "./run-log";
import { RunOutcomeBanner } from "./run-outcome";
import { isTerminal, type RunState, type TimelineItem } from "./run-state";
import { RunStatusBadge } from "./run-status-badge";
import { RunTimeline } from "./run-timeline";
import { useAnalysisRun } from "./use-analysis-run";

/** 运行中每秒刷新一次“当前时间”，用于显示已用时。 */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function RunDetails({ state, timeline, now }: { state: RunState; timeline: TimelineItem[]; now: number }) {
  const live = !isTerminal(state.phase);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.run.timeline}</CardTitle>
        </CardHeader>
        <CardContent>
          <RunTimeline items={timeline} now={now} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base">{copy.run.logs}</CardTitle>
          {live ? <span className="text-xs text-muted-foreground">{copy.run.logsLive}</span> : null}
        </CardHeader>
        <CardContent>
          <RunLog entries={state.logs} live={live} />
        </CardContent>
      </Card>
    </div>
  );
}

export function RunView({ runId }: { runId: string }) {
  const { state, timeline, outcome, timing, notFound, cancel, canceling } = useAnalysisRun(runId);
  const live = !isTerminal(state.phase);
  const now = useNow(live && state.phase !== "connecting");
  const elapsed = timing.startedAt === null ? null : (timing.endedAt ?? now) - timing.startedAt;
  const done = state.phase === "success" && state.result !== null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft />
            {copy.run.back}
          </Link>
        </Button>
        {state.input ? (
          <span className="font-mono text-sm">
            {state.input.repoUrl}
            {state.input.ref ? <span className="text-muted-foreground"> @{state.input.ref}</span> : null}
          </span>
        ) : null}
        {state.phase !== "connecting" ? <RunStatusBadge status={state.phase} /> : null}
        {live && state.phase !== "connecting" ? (
          <Button variant="outline" size="sm" className="ml-auto" onClick={cancel} disabled={canceling}>
            {canceling ? copy.run.canceling : copy.run.cancel}
          </Button>
        ) : null}
      </div>

      {notFound ? (
        <Alert variant="destructive">
          <AlertTitle>{copy.run.notFound}</AlertTitle>
          <AlertDescription className="font-mono">{runId}</AlertDescription>
        </Alert>
      ) : (
        <RunOutcomeBanner outcome={outcome} elapsed={elapsed} />
      )}

      {notFound ? null : done ? (
        <>
          <details className="group rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              {copy.run.details(state.logs.length, elapsed === null ? null : copy.duration(elapsed))}
            </summary>
            <div className="border-t p-4">
              <RunDetails state={state} timeline={timeline} now={now} />
            </div>
          </details>
          <ReportView runId={runId} />
        </>
      ) : (
        <RunDetails state={state} timeline={timeline} now={now} />
      )}
    </div>
  );
}
