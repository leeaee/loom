"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copy } from "@/lib/copy";
import { Citations } from "../citations";
import type { SectionProps } from "./types";

export function DataModelSection({ artifact }: SectionProps<"data-model">) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed">{artifact.summary}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {artifact.entities.map((entity) => (
          <Card key={entity.name}>
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2 font-mono text-base">
                {entity.name}
                <Badge variant="outline">{entity.kind}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{entity.description}</p>
              <Citations citations={entity.citations} />
            </CardHeader>
            <CardContent className="grid gap-3">
              {entity.fields.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.report.columns.field}</TableHead>
                      <TableHead>{copy.report.columns.type}</TableHead>
                      <TableHead>{copy.report.columns.description}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entity.fields.map((field) => (
                      <TableRow key={field.name}>
                        <TableCell className="font-mono text-xs">
                          {field.name}
                          {field.optional ? <span className="text-muted-foreground">?</span> : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{field.type}</TableCell>
                        <TableCell className="whitespace-normal text-xs">{field.description ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              {entity.relations.length > 0 ? (
                <div className="grid gap-1 text-sm">
                  <span className="font-medium">{copy.report.dataModel.relations}</span>
                  <ul className="grid gap-1">
                    {entity.relations.map((relation) => (
                      <li
                        key={`${relation.kind}-${relation.target}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Badge variant="secondary">{relation.kind}</Badge>
                        <span className="font-mono text-xs">{relation.target}</span>
                        {relation.description ? (
                          <span className="text-xs text-muted-foreground">{relation.description}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
