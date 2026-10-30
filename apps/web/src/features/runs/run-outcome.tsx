import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CircleX,
  DatabaseZap,
  LoaderCircle,
  Pause,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import type { RunOutcome } from "./run-state";

type Props = { outcome: RunOutcome; elapsed: number | null };

export function RunOutcomeBanner({ outcome, elapsed }: Props) {
  const o = copy.run.outcome;
  const duration = elapsed === null ? null : copy.duration(elapsed);
  switch (outcome.kind) {
    case "connecting":
      return (
        <Alert>
          <LoaderCircle className="animate-spin" />
          <AlertTitle>{o.connecting}</AlertTitle>
        </Alert>
      );
    case "running":
      return (
        <Alert className="border-primary/40">
          <LoaderCircle className="animate-spin" />
          <AlertTitle>{o.running}</AlertTitle>
          <AlertDescription>
            {o.runningDetail(
              outcome.current ? copy.steps[outcome.current] : null,
              outcome.done,
              outcome.total,
              duration,
            )}
          </AlertDescription>
        </Alert>
      );
    case "success":
      return (
        <Alert className="border-success/50 text-success">
          <CircleCheck />
          <AlertTitle>{o.success}</AlertTitle>
          <AlertDescription>{o.successDetail(outcome.analyses, duration)}</AlertDescription>
        </Alert>
      );
    case "partial":
      return (
        <Alert className="border-warning/60 text-warning">
          <CircleAlert />
          <AlertTitle>{o.partial}</AlertTitle>
          <AlertDescription>
            {o.partialDetail(
              outcome.failed.map((id) => copy.analyses[id]),
              outcome.analyses,
            )}
          </AlertDescription>
        </Alert>
      );
    case "cached":
      return (
        <Alert className="border-success/50">
          <DatabaseZap className="text-success" />
          <AlertTitle>{o.cached}</AlertTitle>
          <AlertDescription>{o.cachedDetail}</AlertDescription>
        </Alert>
      );
    case "failed":
      return (
        <Alert variant="destructive" className="border-destructive/50">
          <CircleX />
          <AlertTitle>
            {outcome.step ? `${o.failed}：${o.failedAt(copy.steps[outcome.step])}` : o.failed}
          </AlertTitle>
          {outcome.message ? (
            <AlertDescription className="break-words">{outcome.message}</AlertDescription>
          ) : null}
        </Alert>
      );
    case "canceled":
      return (
        <Alert>
          <CircleMinus />
          <AlertTitle>{o.canceled}</AlertTitle>
          <AlertDescription>{o.canceledDetail}</AlertDescription>
        </Alert>
      );
    case "suspended":
      return (
        <Alert>
          <Pause />
          <AlertTitle>{o.suspended}</AlertTitle>
        </Alert>
      );
  }
}
