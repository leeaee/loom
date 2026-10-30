import { describe, expect, it } from "vitest";
import { resolveModel } from "../src/analyses/shared/create-agent";
import { modelLabel, parseConfig } from "../src/config/index";

const base = { LOOM_DATA_DIR: "/tmp/loom-data", LOOM_SKILLS_DIR: "/tmp/loom-skills" };

describe("model configuration", () => {
  it("uses the provider route when no custom URL is set", () => {
    const config = parseConfig({ ...base, LOOM_AGENT_MODE: "real", LOOM_MODEL: "openai/gpt-5.1" });
    expect(config.modelUrl).toBeNull();
    expect(resolveModel(config)).toBe("openai/gpt-5.1");
    expect(modelLabel(config)).toBe("openai/gpt-5.1");
  });

  it("switches to an OpenAI-compatible endpoint when LOOM_MODEL_URL is set", () => {
    const config = parseConfig({
      ...base,
      LOOM_AGENT_MODE: "real",
      LOOM_MODEL: "deepseek/deepseek-chat",
      LOOM_MODEL_URL: "https://api.deepseek.com/v1/",
      LOOM_MODEL_API_KEY: "sk-test",
    });
    expect(resolveModel(config)).toEqual({
      id: "deepseek/deepseek-chat",
      url: "https://api.deepseek.com/v1",
      apiKey: "sk-test",
    });
    expect(modelLabel(config)).toBe("deepseek/deepseek-chat @ https://api.deepseek.com/v1");
  });

  it("leaves the API key to provider env vars when LOOM_MODEL_API_KEY is empty", () => {
    const config = parseConfig({
      ...base,
      LOOM_AGENT_MODE: "real",
      LOOM_MODEL: "ollama/qwen3",
      LOOM_MODEL_URL: "http://localhost:11434/v1",
      LOOM_MODEL_API_KEY: "",
    });
    expect(resolveModel(config)).toEqual({ id: "ollama/qwen3", url: "http://localhost:11434/v1" });
  });

  it("rejects a non-http model URL with a Chinese hint", () => {
    expect(() =>
      parseConfig({
        ...base,
        LOOM_AGENT_MODE: "real",
        LOOM_MODEL: "x/y",
        LOOM_MODEL_URL: "ftp://example.com",
      }),
    ).toThrow(/LOOM_MODEL_URL 必须是 http\(s\) 地址/);
  });
});
