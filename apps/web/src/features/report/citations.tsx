"use client";

import type { Citation } from "@loom/contracts";
import { TriangleAlert } from "lucide-react";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useReportContext } from "./report-context";

/** 引用徽章：GitHub 仓库可点击跳到对应提交的源码行；未核实的引用标黄。 */
export function Citations({ citations, className }: { citations: readonly Citation[]; className?: string }) {
  const { isUnverified, sourceUrl } = useReportContext();
  if (citations.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {citations.map((c, index) => {
        const label = c.line ? `${c.path}:${c.line}` : c.path;
        const key = `${label}#${index}`;
        const unverified = isUnverified(c.path, c.line);
        const href = sourceUrl(c.path, c.line);
        const classes = cn(
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs",
          unverified ? "border-warning/60 text-warning" : "text-muted-foreground hover:text-foreground",
        );
        const content = (
          <>
            {unverified ? <TriangleAlert className="size-3" aria-label={copy.report.unverified} /> : null}
            {label}
          </>
        );
        return href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={classes}
            title={unverified ? copy.report.unverifiedHint : undefined}
          >
            {content}
          </a>
        ) : (
          <span key={key} className={classes} title={unverified ? copy.report.unverifiedHint : undefined}>
            {content}
          </span>
        );
      })}
    </span>
  );
}
