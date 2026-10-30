"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { Citations } from "../citations";
import { MermaidDiagram } from "../mermaid-diagram";
import type { SectionProps } from "./types";

export function ArchitectureFlowSection({ artifact }: SectionProps<"architecture-flow">) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed">{artifact.summary}</p>
      <Card>
        <CardHeader>
          <CardTitle>{copy.report.architecture.diagram}</CardTitle>
        </CardHeader>
        <CardContent>
          <MermaidDiagram code={artifact.mermaid} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.report.architecture.components}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {artifact.components.map((component) => (
                <li key={component.id} className="grid gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{component.name}</span>
                    <Badge variant="outline">{component.kind}</Badge>
                  </div>
                  <p className="text-muted-foreground">{component.responsibility}</p>
                  <Citations citations={component.citations} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.report.architecture.flows}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-4">
              {artifact.flows.map((flow) => (
                <li key={flow.name} className="grid gap-1.5 text-sm">
                  <span className="font-medium">{flow.name}</span>
                  <ol className="ml-5 list-decimal text-muted-foreground">
                    {flow.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <Citations citations={flow.citations} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
