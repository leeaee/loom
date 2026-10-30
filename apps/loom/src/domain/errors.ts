import type { StepError } from "@loom/contracts";

export type LoomErrorCode =
  | "INVALID_REPO_URL"
  | "LOCAL_REPO_FORBIDDEN"
  | "GIT_FAILED"
  | "GIT_REF_NOT_FOUND"
  | "LOCK_TIMEOUT"
  | "AGENT_FAILED"
  | "AGENT_OUTPUT_INVALID"
  | "REPORT_NOT_FOUND"
  | "COMMAND_FORBIDDEN"
  | "MCP_UNAVAILABLE";

/** infra 与步骤层统一抛出的错误，带稳定的 code，便于前端和日志识别。 */
export class LoomError extends Error {
  override readonly name = "LoomError";
  constructor(
    readonly code: LoomErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** domain 用结果对象表达业务失败，不抛异常。 */
export type Result<T, E = LoomError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function toStepError(step: string, error: unknown): StepError {
  if (error instanceof LoomError) return { step, code: error.code, message: error.message };
  if (error instanceof Error) return { step, code: "UNEXPECTED", message: error.message };
  return { step, code: "UNEXPECTED", message: String(error) };
}

/** 日志与错误信息统一脱敏：Authorization 头、GitHub 令牌、URL 中的凭据。 */
export function redactSecrets(text: string): string {
  return text
    .replace(/(authorization:\s*)(?:bearer|basic|token)\s+[^\s"']+/gi, "$1***")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "***")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "***")
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1***@");
}
