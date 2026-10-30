"use client";

import type { Confidence } from "@loom/contracts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copy } from "@/lib/copy";
import { Citations } from "../citations";
import type { SectionProps } from "./types";

const CONFIDENCE_VARIANT: Record<Confidence, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function TechChoiceSection({ artifact }: SectionProps<"tech-choice">) {
  const t = copy.report.techChoice;
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed">{artifact.summary}</p>
      <Card>
        <CardHeader>
          <CardTitle>{t.current}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.report.columns.category}</TableHead>
                <TableHead>{copy.report.columns.choice}</TableHead>
                <TableHead>{copy.report.columns.assessment}</TableHead>
                <TableHead>{copy.report.columns.location}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artifact.current.map((item) => (
                <TableRow key={`${item.category}-${item.choice}`}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="font-medium">{item.choice}</TableCell>
                  <TableCell className="whitespace-normal">{item.assessment}</TableCell>
                  <TableCell>
                    <Citations citations={item.citations} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <h3 className="text-base font-semibold">{t.recommendations}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {artifact.recommendations.map((rec) => (
          <Card key={`${rec.category}-${rec.recommendation}`}>
            <CardHeader className="gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{rec.category}</Badge>
                <Badge variant={CONFIDENCE_VARIANT[rec.confidence]}>{t.confidence[rec.confidence]}</Badge>
              </div>
              <CardTitle className="text-base">{rec.recommendation}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-1">
                <span className="font-medium">{t.rationale}</span>
                <p className="text-muted-foreground">{rec.rationale}</p>
              </div>
              {rec.alternatives.length > 0 ? (
                <div className="grid gap-1">
                  <span className="font-medium">{t.alternatives}</span>
                  <ul className="grid gap-1">
                    {rec.alternatives.map((alt) => (
                      <li key={alt.name}>
                        <span className="font-medium">{alt.name}</span>
                        <span className="text-muted-foreground">：{alt.tradeoff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Citations citations={rec.citations} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
