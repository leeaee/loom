"use client";

import { analyzeInputSchema } from "@loom/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { analyzeWorkflow } from "@/lib/mastra";

export function NewRunForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = analyzeInputSchema.safeParse({
      repoUrl: form.get("repoUrl"),
      ref: (form.get("ref") as string | null) || undefined,
      force: form.get("force") === "on",
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("；"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const run = await analyzeWorkflow().createRun();
      // 必须用 stream 启动：只有这样服务端才会记录事件流，运行页的 observe 才能回放并实时接收进度。
      // 读到第一个事件即说明运行已开始；断开连接不会中止服务端的运行。
      const reader = (await run.stream({ inputData: parsed.data })).getReader();
      await reader.read();
      await reader.cancel();
      await queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push(`/runs/${run.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.newRun.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5 text-sm">
            <label htmlFor="repoUrl" className="font-medium">
              {copy.newRun.repoLabel}
            </label>
            <Input
              id="repoUrl"
              name="repoUrl"
              required
              placeholder={copy.newRun.repoPlaceholder}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5 text-sm">
            <label htmlFor="ref" className="font-medium">
              {copy.newRun.refLabel}
            </label>
            <Input id="ref" name="ref" placeholder={copy.newRun.refPlaceholder} autoComplete="off" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="force" className="size-4" />
            {copy.newRun.force}
          </label>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{copy.newRun.failed}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={submitting} className="justify-self-start">
            {submitting ? copy.newRun.submitting : copy.newRun.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
