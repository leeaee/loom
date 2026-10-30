import type { RunStatus } from "@loom/contracts";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";

const VARIANT: Record<RunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  success: "default",
  failed: "destructive",
  canceled: "outline",
  suspended: "outline",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge variant={VARIANT[status]}>{copy.runStatus[status]}</Badge>;
}
