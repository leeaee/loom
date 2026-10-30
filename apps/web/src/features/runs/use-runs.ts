"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns } from "@/lib/api";

export function useRecentRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: fetchRuns,
    refetchInterval: (query) =>
      query.state.data?.runs.some((r) => r.status === "running" || r.status === "pending") ? 3000 : false,
  });
}
