import { CircleCheck, CircleDashed, CircleMinus, CircleX, LoaderCircle } from "lucide-react";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { StepStatus, TimelineItem } from "./run-state";

const ICON: Record<StepStatus, typeof CircleCheck> = {
  pending: CircleDashed,
  running: LoaderCircle,
  success: CircleCheck,
  failed: CircleX,
  skipped: CircleMinus,
};

const TONE: Record<StepStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-foreground",
  success: "text-success",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
};

function StatusIcon({ status }: { status: StepStatus }) {
  const Icon = ICON[status];
  return (
    <Icon
      aria-label={copy.stepStatus[status]}
      className={cn("size-4 shrink-0", TONE[status], status === "running" && "animate-spin")}
    />
  );
}

type Timed = { status: StepStatus; startedAt: number | null; endedAt: number | null };

function Duration({ item, now }: { item: Timed; now: number }) {
  if (item.startedAt === null) return null;
  const end = item.endedAt ?? (item.status === "running" ? now : null);
  if (end === null) return null;
  return (
    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
      {copy.duration(end - item.startedAt)}
    </span>
  );
}

export function RunTimeline({ items, now }: { items: TimelineItem[]; now: number }) {
  return (
    <ol className="grid gap-3" aria-label={copy.run.timeline}>
      {items.map((item) => (
        <li key={item.id} className="grid gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon status={item.status} />
            <span className={cn("font-medium", item.status === "pending" && "text-muted-foreground")}>
              {copy.steps[item.id]}
            </span>
            <span className={cn("text-xs", TONE[item.status])}>{copy.stepStatus[item.status]}</span>
            <Duration item={item} now={now} />
          </div>
          {item.error && item.children.length === 0 ? (
            <p className="ml-6 text-xs break-words text-destructive">{item.error}</p>
          ) : null}
          {item.children.length > 0 ? (
            <ul className="ml-6 grid gap-1">
              {item.children.map((child) => (
                <li key={child.id} className="grid gap-0.5 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={child.status} />
                    <span>{copy.analyses[child.id]}</span>
                    <Duration item={child} now={now} />
                  </div>
                  {child.error ? (
                    <p className="ml-6 text-xs break-words text-destructive">{child.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
