"use client";

import { type ColumnDef, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** 报告里的表格只做展示，不需要排序、分页等可选特性。 */
export const reportTableFeatures = tableFeatures({});
export type ReportColumn<T extends RowData> = ColumnDef<typeof reportTableFeatures, T>;

export function DataTable<T extends RowData>({ columns, data }: { columns: ReportColumn<T>[]; data: T[] }) {
  const table = useTable({ features: reportTableFeatures, columns, data });
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id} className="align-top whitespace-normal">
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
