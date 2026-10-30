"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { copy } from "@/lib/copy";

/**
 * 客户端按需加载 Mermaid，securityLevel 固定为 strict（禁用点击回调并净化 SVG）。
 * 渲染失败时退回显示原始文本，模型生成的图有语法错误也不影响整页。
 */
export function MermaidDiagram({ code }: { code: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        const { svg } = await mermaid.render(id, code);
        if (canceled) return;
        setError(null);
        if (container.current) container.current.innerHTML = svg;
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className="grid gap-2">
        <Alert>
          <AlertDescription>
            {copy.report.mermaidFailed}
            <span className="block text-xs text-muted-foreground">{error}</span>
          </AlertDescription>
        </Alert>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{code}</pre>
      </div>
    );
  }
  return (
    <div
      ref={container}
      data-testid="mermaid"
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-w-full"
    />
  );
}
