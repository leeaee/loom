import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["loom", "web", "contracts", "harness", "repo", "deps", "docs", "ci"]],
  },
};

export default config;
