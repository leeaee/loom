"use client";

import type { Report } from "@loom/contracts";
import { createContext, type ReactNode, useContext, useMemo } from "react";

type ReportContextValue = {
  report: Report;
  isUnverified: (path: string, line: number | null) => boolean;
  sourceUrl: (path: string, line: number | null) => string | null;
};

const ReportContext = createContext<ReportContextValue | null>(null);

const normalize = (path: string) =>
  path
    .replace(/^\/repo\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

export function ReportProvider({ report, children }: { report: Report; children: ReactNode }) {
  const value = useMemo<ReportContextValue>(() => {
    const unverified = new Set(
      report.citationCheck.unverified.map((u) => `${normalize(u.path)}:${u.line ?? ""}`),
    );
    const { host, owner, name, sha } = report.repo;
    return {
      report,
      isUnverified: (path, line) => unverified.has(`${normalize(path)}:${line ?? ""}`),
      sourceUrl: (path, line) =>
        host === "github.com"
          ? `https://github.com/${owner}/${name}/blob/${sha}/${normalize(path)
              .split("/")
              .map(encodeURIComponent)
              .join("/")}${line ? `#L${line}` : ""}`
          : null,
    };
  }, [report]);
  return <ReportContext value={value}>{children}</ReportContext>;
}

export function useReportContext(): ReportContextValue {
  const value = useContext(ReportContext);
  if (!value) throw new Error("useReportContext 必须在 ReportProvider 内使用");
  return value;
}
