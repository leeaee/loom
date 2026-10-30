"use client";

import type { RuntimeInfo } from "@loom/contracts";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRuntime } from "@/lib/api";
import { copy } from "@/lib/copy";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs break-all">{children}</dd>
    </div>
  );
}

export function RuntimeDetails({ info }: { info: RuntimeInfo }) {
  const r = copy.runtime;
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Badge variant={info.mode === "fake" ? "outline" : "default"} className="w-fit">
          {r.mode[info.mode]}
        </Badge>
        <p className="text-sm text-muted-foreground">{r.modeHint[info.mode]}</p>
      </div>
      <dl className="grid gap-3">
        <Row label={r.model}>{info.model ?? r.notSet}</Row>
        <Row label={r.modelUrl}>{info.modelUrl ?? r.modelUrlDefault}</Row>
        {info.mode === "fake" ? <Row label={r.fakeDelay}>{copy.duration(info.fakeDelayMs)}</Row> : null}
        <Row label={r.dataDir}>
          {info.dataDir}
          <span className="mt-0.5 block font-sans text-muted-foreground">{r.dataLayout}</span>
        </Row>
        <Row label={r.envFile}>{info.envFile}</Row>
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">{r.howTo}</p>
    </div>
  );
}

export function RuntimeInfoCard() {
  const { data, isPending, isError } = useQuery({ queryKey: ["runtime"], queryFn: fetchRuntime });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.runtime.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <Alert>
            <AlertDescription>{copy.runtime.loadFailed}</AlertDescription>
          </Alert>
        ) : (
          <RuntimeDetails info={data} />
        )}
      </CardContent>
    </Card>
  );
}
