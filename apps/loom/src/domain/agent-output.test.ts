import { analysisDefinitions } from "@loom/contracts";
import { fixtureArtifacts } from "@loom/contracts/fixtures";
import { describe, expect, it } from "vitest";
import { extractJsonObject, parseAgentOutput } from "./agent-output";

const schema = analysisDefinitions["data-model"].artifact;
const artifact = fixtureArtifacts["data-model"];
const json = JSON.stringify(artifact);

describe("extractJsonObject", () => {
  it("parses plain JSON, fenced blocks and JSON after prose that itself contains braces", () => {
    expect(extractJsonObject(json)).toEqual(artifact);
    expect(extractJsonObject(`结果如下：\n\`\`\`json\n${json}\n\`\`\`\n以上。`)).toEqual(artifact);
    expect(extractJsonObject(`解构 { value, unit } 之后得到：${json}`)).toEqual(artifact);
  });

  it("returns undefined when there is no JSON object", () => {
    expect(extractJsonObject("")).toBeUndefined();
    expect(extractJsonObject("没有结构化结果 {")).toBeUndefined();
  });
});

describe("parseAgentOutput", () => {
  it("accepts a valid object from the framework as is", () => {
    const result = parseAgentOutput(schema, { object: artifact, text: "" });
    expect(result).toEqual({ ok: true, value: { value: artifact, unwrappedKey: null } });
  });

  it("unwraps a single wrapper key such as dataModel", () => {
    const result = parseAgentOutput(schema, { text: JSON.stringify({ dataModel: artifact }) });
    expect(result.ok && result.value.unwrappedKey).toBe("dataModel");
    expect(result.ok && result.value.value).toEqual(artifact);
  });

  it("reports schema issues and explains a missing final reply", () => {
    const invalid = parseAgentOutput(schema, { text: JSON.stringify({ summary: 1 }) });
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && invalid.error).toContain("summary");
    const empty = parseAgentOutput(schema, { text: "  " });
    expect(!empty.ok && empty.error).toContain("没有给出最终回复");
  });
});
