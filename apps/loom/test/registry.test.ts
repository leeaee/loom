import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analysisDefinitions, analysisIds } from "@loom/contracts";
import { describe, expect, it } from "vitest";
import { analysisAgents, analysisModules, getAnalysisModule, runtimeSkillNames } from "../src/analyses/index";

const skillsDir = fileURLToPath(new URL("../skills/", import.meta.url));
const webSectionsDir = fileURLToPath(new URL("../../web/src/features/report/sections/", import.meta.url));

function frontmatter(skill: string): Record<string, string> {
  const content = readFileSync(`${skillsDir}${skill}/SKILL.md`, "utf8");
  const block = /^---\n([\s\S]*?)\n---\n/.exec(content)?.[1] ?? "";
  return Object.fromEntries(
    block
      .split("\n")
      .map((line) => /^([\w-]+):\s*(.*)$/.exec(line))
      .filter((match) => match !== null)
      .map((match) => [match[1], (match[2] ?? "").replace(/^["']|["']$/g, "")]),
  );
}

/**
 * 新增分析时这里会提示缺了哪一块：contracts 的 id、模块、运行时技能、Web 分区。
 */
describe("analysis registry consistency", () => {
  it("registers exactly one module per analysisId, in contract order", () => {
    expect(analysisModules.map((m) => m.id)).toEqual([...analysisIds]);
  });

  it.each(analysisIds)("%s: phase, skill and web section line up", (id) => {
    const module = getAnalysisModule(id);
    expect(module.phase).toBe(analysisDefinitions[id].phase);
    expect(module.skill).toBe(id);
    expect(
      existsSync(`${webSectionsDir}${id}.tsx`),
      `缺少 apps/web/src/features/report/sections/${id}.tsx`,
    ).toBe(true);
  });

  it("has a SKILL.md for every runtime skill, with matching frontmatter", () => {
    for (const skill of runtimeSkillNames) {
      const meta = frontmatter(skill);
      expect(meta.name, `skills/${skill}/SKILL.md 的 name`).toBe(skill);
      expect(meta.description?.length ?? 0, `skills/${skill}/SKILL.md 的 description`).toBeGreaterThan(20);
    }
  });

  it("has no orphan skill directories", () => {
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs.sort()).toEqual([...runtimeSkillNames].sort());
  });

  it("gives every agent a unique id", () => {
    const ids = [...analysisModules.map((m) => m.agent.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(analysisAgents)).toHaveLength(runtimeSkillNames.length);
  });
});
