import { fail, LoomError, ok, type Result } from "./errors";

export type AllowedCommand = { interpreter: string; script: string; skill: string; args: string[] };

const INTERPRETERS = new Set(["node", "python3", "bash", "sh"]);
const SCRIPT = /^(?:\.\/)?skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/scripts\/[A-Za-z0-9._-]+$/;
const SAFE_ARG = /^[A-Za-z0-9._/@:=,+-]+$/;
const SHELL_META = /[;&|`$<>(){}\\\n\r*?!~'"]/;

/**
 * 沙箱命令白名单：只允许 `<解释器> skills/<技能>/scripts/<文件> [参数...]`。
 * 不允许 shell 元字符、上级目录、绝对路径参数，确保被分析仓库的代码永远不会被执行。
 */
export function checkSkillCommand(command: string): Result<AllowedCommand> {
  const deny = (reason: string) =>
    fail(new LoomError("COMMAND_FORBIDDEN", `命令被拒绝（${reason}）：只能运行技能目录下 scripts/ 中的脚本`));

  const trimmed = command.trim();
  if (!trimmed) return deny("空命令");
  if (SHELL_META.test(trimmed)) return deny("包含 shell 元字符");

  const [interpreter = "", script = "", ...args] = trimmed.split(/\s+/);
  if (!INTERPRETERS.has(interpreter)) return deny(`解释器 ${interpreter} 不在白名单`);
  const match = SCRIPT.exec(script);
  if (!match?.[1]) return deny("脚本不在 skills/<name>/scripts/ 下");
  if (script.split("/").includes("..")) return deny("路径包含 ..");
  for (const arg of args) {
    if (!SAFE_ARG.test(arg) || arg.split("/").includes("..") || arg.startsWith("/")) {
      return deny(`参数 ${arg} 不合法`);
    }
  }
  return ok({ interpreter, script: script.replace(/^\.\//, ""), skill: match[1], args });
}
