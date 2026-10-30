"use client";

import type { ApiEntry } from "@loom/contracts";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";
import { Citations } from "../citations";
import { DataTable, type ReportColumn, type reportTableFeatures } from "../data-table";
import type { SectionProps } from "./types";

const helper = createColumnHelper<typeof reportTableFeatures, ApiEntry>();
const columns = helper.columns([
  helper.accessor("kind", {
    header: copy.report.columns.kind,
    cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
  }),
  helper.accessor("method", { header: copy.report.columns.method, cell: (info) => info.getValue() ?? "" }),
  helper.accessor("name", {
    header: copy.report.columns.name,
    cell: (info) => (
      <div className="grid gap-0.5">
        <code className="font-mono text-xs">{info.getValue()}</code>
        {info.row.original.signature ? (
          <code className="font-mono text-xs text-muted-foreground">{info.row.original.signature}</code>
        ) : null}
      </div>
    ),
  }),
  helper.accessor("description", { header: copy.report.columns.description }),
  helper.accessor("citations", {
    header: copy.report.columns.location,
    cell: (info) => <Citations citations={info.getValue()} />,
  }),
]) as ReportColumn<ApiEntry>[];

export function ApiSurfaceSection({ artifact }: SectionProps<"api-surface">) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed">{artifact.summary}</p>
      <DataTable columns={columns} data={artifact.entries} />
    </div>
  );
}
