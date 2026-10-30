"use client";

import { analysisIds, type Report } from "@loom/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { Citations } from "../citations";

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function OverviewSection({ report }: { report: Report }) {
  const m = copy.report.meta;
  const { repo, scout, citationCheck } = report;
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label={m.repo}>
              <a
                href={repo.url.replace(/\.git$/, "")}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline"
              >
                {repo.owner}/{repo.name}
              </a>
              {repo.ref ? <span className="text-muted-foreground"> @{repo.ref}</span> : null}
            </Meta>
            <Meta label={m.commit}>
              <code className="font-mono text-xs">{repo.sha.slice(0, 12)}</code>
            </Meta>
            <Meta label={m.createdAt}>{timeFormat.format(new Date(report.createdAt))}</Meta>
            <Meta label={m.mode}>
              {report.mode}
              {report.model ? ` · ${report.model}` : ""}
            </Meta>
            <Meta label={m.files}>
              {scout.totalFiles} / {scout.sourceFiles}
            </Meta>
            <Meta label={m.languages}>
              {scout.languages.map((l) => `${l.language} ${l.files}`).join("、") || "—"}
            </Meta>
            <Meta label={copy.report.citations}>
              {citationCheck.verified} / {citationCheck.total}
            </Meta>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {analysisIds.map((id) => {
          const artifact = report.artifacts[id];
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle className="text-base">{copy.analyses[id]}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {artifact ? artifact.summary : copy.report.missingArtifact}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {report.digests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.digests}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {report.digests.map((d) => (
                <li key={d.module} className="grid gap-1">
                  <span className="font-mono font-medium">{d.module}</span>
                  <span className="text-muted-foreground">{d.summary}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {report.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{copy.report.errors}</AlertTitle>
          <AlertDescription>
            <ul className="grid gap-1">
              {report.errors.map((e, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 只读列表，同一步骤可能有多条同码错误
                <li key={`${e.step}-${e.code}-${i}`}>
                  <span className="font-mono">{e.step}</span>（{e.code}）：{e.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {citationCheck.unverified.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {copy.report.unverified}（{citationCheck.unverified.length}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {citationCheck.unverified.map((u, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: 只读列表；旧版报告里同一引用可能重复出现
                  key={`${u.source}-${u.path}-${u.line}-${i}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Citations citations={[{ path: u.path, line: u.line }]} />
                  <span className="text-xs text-muted-foreground">
                    {u.source} · {u.reason}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
