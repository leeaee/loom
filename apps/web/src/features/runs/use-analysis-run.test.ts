import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalysisRun } from "./use-analysis-run";

const runById = vi.fn();
const observe = vi.fn();

vi.mock("@/lib/mastra", () => ({
  analyzeWorkflow: () => ({
    runById,
    createRun: async () => ({ observe, cancel: vi.fn() }),
  }),
}));
vi.mock("@/lib/api", () => ({ fetchRunLogs: async () => [] }));

function brokenStream() {
  return new ReadableStream({
    pull(controller) {
      controller.error(new TypeError("network error"));
    },
  });
}

describe("useAnalysisRun", () => {
  beforeEach(() => {
    runById.mockReset();
    observe.mockReset();
  });

  it("falls back to polling when the event stream breaks instead of reporting a failure", async () => {
    runById.mockResolvedValueOnce({ status: "running" }).mockResolvedValue({ status: "success" });
    observe.mockResolvedValue(brokenStream());

    const { result } = renderHook(() => useAnalysisRun("run-1"));

    await waitFor(() => expect(result.current.state.phase).toBe("success"));
    expect(result.current.state.error).toBeNull();
    expect(runById).toHaveBeenCalledTimes(2);
  });
});
