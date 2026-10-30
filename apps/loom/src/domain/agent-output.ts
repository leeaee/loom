import type { z } from "zod";
import { fail, ok, type Result } from "./errors";

const FENCE = /```(?:json)?\s*\n([\s\S]*?)\n?```/g;

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * 从模型的文字回复里找出 JSON 对象：整段即 JSON、``` 代码块、或夹在说明文字中间的最外层对象。
 * 说明文字本身可能含 `{`，所以从每个 `{` 起尝试解析到最后一个 `}`，取第一个成功的（也就是最大的）。
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const whole = tryParse(trimmed);
  if (whole !== undefined) return whole;

  const fenced = [...trimmed.matchAll(FENCE)].reverse();
  for (const match of fenced) {
    const value = tryParse(match[1] ?? "");
    if (value !== undefined) return value;
  }

  const end = trimmed.lastIndexOf("}");
  for (
    let start = trimmed.indexOf("{");
    start !== -1 && start < end;
    start = trimmed.indexOf("{", start + 1)
  ) {
    const value = tryParse(trimmed.slice(start, end + 1));
    if (value !== undefined) return value;
  }
  return undefined;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `- ${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("\n");
}

export type AgentOutput<T> = {
  value: T;
  /** 模型多包了一层时被拆掉的键名，例如 `dataModel` */
  unwrappedKey: string | null;
};

/**
 * 按合同解析 Agent 产出：优先用框架解析出的对象，其次从文字回复里提取 JSON；
 * 模型把结果包在单个键下（如 `{"dataModel": {...}}`）时拆掉这一层再校验。
 */
export function parseAgentOutput<T>(
  schema: z.ZodType<T>,
  raw: { object?: unknown; text: string },
): Result<AgentOutput<T>, string> {
  const candidate = raw.object ?? extractJsonObject(raw.text);
  if (candidate === undefined || candidate === null) {
    return fail(raw.text.trim() ? "回复中没有可解析的 JSON 对象" : "模型没有给出最终回复（可能用完了步数）");
  }
  const direct = schema.safeParse(candidate);
  if (direct.success) return ok({ value: direct.data, unwrappedKey: null });

  if (typeof candidate === "object" && !Array.isArray(candidate)) {
    const entries = Object.entries(candidate as Record<string, unknown>);
    const [only] = entries;
    if (entries.length === 1 && only && typeof only[1] === "object" && only[1] !== null) {
      const inner = schema.safeParse(only[1]);
      if (inner.success) return ok({ value: inner.data, unwrappedKey: only[0] });
    }
  }
  return fail(formatIssues(direct.error));
}
