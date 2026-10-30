import { analysisIds, type Report } from "@loom/contracts";
import { fixtureReport } from "@loom/contracts/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { MermaidDiagram } from "./mermaid-diagram";
import { ReportTabs, ReportView } from "./report-view";

const mermaid = vi.hoisted(() => ({
  render: vi.fn(async (_id: string, _code: string) => ({ svg: '<svg data-kind="diagram"></svg>' })),
}));

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render: mermaid.render } }));

afterEach(() => {
  cleanup();
  mermaid.render.mockClear();
});

describe("ReportTabs", () => {
  it("renders the overview and one tab per analysis", () => {
    render(<ReportTabs report={fixtureReport} />);
    expect(screen.getByRole("tab", { name: copy.report.overview })).toBeTruthy();
    for (const id of analysisIds) expect(screen.getByRole("tab", { name: copy.analyses[id] })).toBeTruthy();
    expect(screen.getByText(fixtureReport.repo.sha.slice(0, 7), { exact: false })).toBeTruthy();
  });

  it("warns that a fake-mode report contains sample data only", () => {
    const { unmount } = render(<ReportTabs report={fixtureReport} />);
    expect(screen.getByText(copy.report.fakeNotice)).toBeTruthy();
    unmount();
    render(<ReportTabs report={{ ...fixtureReport, mode: "real", model: "openai/gpt-5.1" }} />);
    expect(screen.queryByText(copy.report.fakeNotice)).toBeNull();
    expect(screen.getByText(`${copy.runtime.mode.real} · openai/gpt-5.1`)).toBeTruthy();
  });

  it("shows the API catalog as a table", async () => {
    render(<ReportTabs report={fixtureReport} />);
    await userEvent.click(screen.getByRole("tab", { name: copy.analyses["api-surface"] }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByText("/todos").length).toBeGreaterThan(0);
    expect(screen.getByText("/healthz")).toBeTruthy();
  });

  it("renders architecture diagrams through mermaid", async () => {
    render(<ReportTabs report={fixtureReport} />);
    await userEvent.click(screen.getByRole("tab", { name: copy.analyses["architecture-flow"] }));
    await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByTestId("mermaid")[0]?.innerHTML).toContain("diagram"));
  });

  it("explains a missing artifact with the recorded step error", async () => {
    const { "data-model": _omitted, ...artifacts } = fixtureReport.artifacts;
    const report: Report = {
      ...fixtureReport,
      artifacts,
      errors: [{ step: "data-model", code: "AGENT_FAILED", message: "模型调用超时" }],
    };
    render(<ReportTabs report={report} />);
    await userEvent.click(screen.getByRole("tab", { name: copy.analyses["data-model"] }));
    expect(screen.getByText(copy.report.missingArtifact)).toBeTruthy();
    expect(screen.getAllByText("模型调用超时").length).toBeGreaterThan(0);
  });
});

describe("ReportView", () => {
  function renderView(body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ReportView runId={fixtureReport.runId} />
      </QueryClientProvider>,
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("renders a report that matches the contract", async () => {
    renderView(fixtureReport);
    expect(await screen.findByRole("tab", { name: copy.report.overview })).toBeTruthy();
  });

  it("explains which fields break the contract", async () => {
    renderView({ ...fixtureReport, schemaVersion: 999, scout: undefined });
    expect(await screen.findByText(copy.report.contractMismatch, { exact: false })).toBeTruthy();
    expect(screen.getByText(/schemaVersion/)).toBeTruthy();
    expect(screen.getByText(/scout/)).toBeTruthy();
  });
});

describe("MermaidDiagram", () => {
  it("falls back to the raw source when mermaid cannot parse it", async () => {
    mermaid.render.mockRejectedValueOnce(new Error("Parse error on line 1"));
    render(<MermaidDiagram code="graph TD; A-->" />);
    expect(await screen.findByText(copy.report.mermaidFailed)).toBeTruthy();
    expect(screen.getByText("Parse error on line 1")).toBeTruthy();
    expect(screen.getByText("graph TD; A-->")).toBeTruthy();
  });
});
