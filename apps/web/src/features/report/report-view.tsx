"use client";

import { type AnalysisId, type ArtifactOf, analysisIds, type Report } from "@loom/contracts";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { ComponentType } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractError, fetchReport, reportMarkdownUrl } from "@/lib/api";
import { copy } from "@/lib/copy";
import { ReportProvider } from "./report-context";
import { OverviewSection } from "./sections/overview";
import { reportSections } from "./sections/registry";
import type { SectionProps } from "./sections/types";

function downloadJson(report: Report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `loom-${report.runId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function AnalysisSection<Id extends AnalysisId>({ id, report }: { id: Id; report: Report }) {
  const artifact = report.artifacts[id] as ArtifactOf<Id> | undefined;
  if (!artifact) {
    const error = report.errors.find((e) => e.step === id);
    return (
      <Alert>
        <AlertTitle>{copy.report.missingArtifact}</AlertTitle>
        {error ? <AlertDescription>{error.message}</AlertDescription> : null}
      </Alert>
    );
  }
  const Section = reportSections[id] as ComponentType<SectionProps<Id>>;
  return <Section artifact={artifact} />;
}

/** 报告的纯展示部分，便于用 contracts 夹具直接测试。 */
export function ReportTabs({ report }: { report: Report }) {
  return (
    <ReportProvider report={report}>
      <Tabs defaultValue="overview" className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="overview">{copy.report.overview}</TabsTrigger>
            {analysisIds.map((id) => (
              <TabsTrigger key={id} value={id}>
                {copy.analyses[id]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={reportMarkdownUrl(report.runId)} download>
                <Download />
                {copy.report.downloadMarkdown}
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadJson(report)}>
              <Download />
              {copy.report.downloadJson}
            </Button>
          </div>
        </div>
        <TabsContent value="overview">
          <OverviewSection report={report} />
        </TabsContent>
        {analysisIds.map((id) => (
          <TabsContent key={id} value={id}>
            <AnalysisSection id={id} report={report} />
          </TabsContent>
        ))}
      </Tabs>
    </ReportProvider>
  );
}

export function ReportView({ runId }: { runId: string }) {
  const { data, error, isPending } = useQuery({
    queryKey: ["report", runId],
    queryFn: () => fetchReport(runId),
  });

  if (isPending) return <Skeleton className="h-96" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{copy.report.loadFailed}</AlertTitle>
        <AlertDescription>
          {error instanceof ContractError ? (
            <>
              {copy.report.contractMismatch}
              <pre className="mt-2 max-h-60 overflow-auto text-xs">
                {error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}
              </pre>
            </>
          ) : (
            error.message
          )}
        </AlertDescription>
      </Alert>
    );
  }
  return <ReportTabs report={data} />;
}
