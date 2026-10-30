import { describe, expect, it } from "vitest";
import { analysisDefinitions, analysisIds } from "./analyses/index";
import { moduleDigestSchema } from "./analyses/module-digest";
import { fixtureArtifacts, fixtureDigest, fixtureReport } from "./fixtures/index";
import { reportSchema } from "./report";
import { stepGroupOf } from "./run";

describe("contracts fixtures", () => {
  it("fixture report matches the report schema", () => {
    expect(reportSchema.parse(fixtureReport)).toEqual(fixtureReport);
  });

  it.each(analysisIds)("fixture artifact for %s matches its schema", (id) => {
    expect(() => analysisDefinitions[id].artifact.parse(fixtureArtifacts[id])).not.toThrow();
  });

  it("fixture digest matches the module digest schema", () => {
    expect(moduleDigestSchema.parse(fixtureDigest("src")).module).toBe("src");
  });

  it("exactly one advise-phase analysis exists", () => {
    const advisers = analysisIds.filter((id) => analysisDefinitions[id].phase === "advise");
    expect(advisers).toEqual(["tech-choice"]);
  });

  it("maps internal step ids to timeline groups", () => {
    expect(stepGroupOf("sync-repo")).toBe("sync-repo");
    expect(stepGroupOf("digest-modules.module-digest")).toBe("digest");
    expect(stepGroupOf("api-surface")).toBe("analyses");
    expect(stepGroupOf("tech-choice")).toBe("advisor");
    expect(stepGroupOf("unknown")).toBeNull();
  });
});
