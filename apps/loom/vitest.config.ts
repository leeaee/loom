import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "loom",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    env: { LOOM_AGENT_MODE: "fake" },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
