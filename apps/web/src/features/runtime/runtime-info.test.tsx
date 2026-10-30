import type { RuntimeInfo } from "@loom/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { RuntimeDetails } from "./runtime-info";

const fake: RuntimeInfo = {
  mode: "fake",
  model: null,
  modelUrl: null,
  fakeDelayMs: 1500,
  dataDir: "/work/loom/.loom",
  envFile: "/work/loom/apps/loom/.env",
};

afterEach(cleanup);

describe("RuntimeDetails", () => {
  it("explains fake mode and where data and config live", () => {
    render(<RuntimeDetails info={fake} />);
    expect(screen.getByText(copy.runtime.mode.fake)).toBeTruthy();
    expect(screen.getByText(copy.runtime.modeHint.fake)).toBeTruthy();
    expect(screen.getByText(copy.runtime.modelUrlDefault)).toBeTruthy();
    expect(screen.getByText("/work/loom/.loom", { exact: false })).toBeTruthy();
    expect(screen.getByText("/work/loom/apps/loom/.env")).toBeTruthy();
  });

  it("shows the configured model and custom endpoint in real mode", () => {
    render(
      <RuntimeDetails
        info={{
          ...fake,
          mode: "real",
          model: "deepseek/deepseek-chat",
          modelUrl: "https://api.deepseek.com/v1",
        }}
      />,
    );
    expect(screen.getByText(copy.runtime.mode.real)).toBeTruthy();
    expect(screen.getByText("deepseek/deepseek-chat")).toBeTruthy();
    expect(screen.getByText("https://api.deepseek.com/v1")).toBeTruthy();
    expect(screen.queryByText(copy.runtime.fakeDelay)).toBeNull();
  });
});
