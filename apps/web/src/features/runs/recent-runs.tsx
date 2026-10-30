"use client";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy";
import { RunStatusBadge } from "./run-status-badge";
import { useRecentRuns } from "./use-runs";

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" });

export function RecentRuns() {
  const { data, isPending, isError } = useRecentRuns();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.recentRuns.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="grid gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : isError ? (
          <Alert>
            <AlertDescription>{copy.recentRuns.loadFailed}</AlertDescription>
          </Alert>
        ) : data.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.recentRuns.empty}</p>
        ) : (
          <ul className="divide-y">
            {data.runs.map((run) => (
              <li key={run.runId}>
                <Link
                  href={`/runs/${run.runId}`}
                  className="flex items-center gap-3 py-2.5 text-sm hover:bg-accent/50 rounded-md px-2 -mx-2"
                >
                  <RunStatusBadge status={run.status} />
                  <span className="truncate font-mono">{run.repoUrl}</span>
                  {run.ref ? <span className="text-muted-foreground">@{run.ref}</span> : null}
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {timeFormat.format(new Date(run.createdAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
