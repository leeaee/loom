import { describe, expect, it } from "vitest";
import { checkSkillCommand } from "./command-policy";

describe("checkSkillCommand", () => {
  it("allows interpreters running a skill script with safe args", () => {
    const result = checkSkillCommand("node skills/api-surface/scripts/find-routes.mjs repo");
    expect(result.ok && result.value).toEqual({
      interpreter: "node",
      script: "skills/api-surface/scripts/find-routes.mjs",
      skill: "api-surface",
      args: ["repo"],
    });
  });

  it.each([
    "npm test",
    "node repo/index.js",
    "node skills/api-surface/scripts/find-routes.mjs repo; rm -rf /",
    "node skills/api-surface/scripts/find-routes.mjs $(whoami)",
    "node skills/api-surface/scripts/find-routes.mjs ../etc",
    "node skills/api-surface/scripts/find-routes.mjs /etc/passwd",
    "node skills/../repo/scripts/x.js",
    "bash -c skills/api-surface/scripts/x.sh",
    "",
  ])("rejects %j", (command) => {
    const result = checkSkillCommand(command);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("COMMAND_FORBIDDEN");
  });
});
