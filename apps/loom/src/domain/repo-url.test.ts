import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "./repo-url";

describe("parseRepoUrl", () => {
  it.each([
    ["vercel/ms", "https://github.com/vercel/ms.git"],
    ["https://github.com/vercel/ms", "https://github.com/vercel/ms.git"],
    ["https://github.com/vercel/ms.git", "https://github.com/vercel/ms.git"],
    ["https://github.com/vercel/ms/tree/main/src", "https://github.com/vercel/ms.git"],
    ["git@github.com:vercel/ms.git", "https://github.com/vercel/ms.git"],
    ["ssh://git@gitlab.com/group/sub/repo.git", "https://gitlab.com/group/sub/repo.git"],
  ])("normalizes %s", (input, url) => {
    const result = parseRepoUrl(input);
    expect(result.ok && result.value.url).toBe(url);
  });

  it("parses nested gitlab groups into owner", () => {
    const result = parseRepoUrl("https://gitlab.com/group/sub/repo");
    expect(result.ok && { owner: result.value.owner, name: result.value.name }).toEqual({
      owner: "group/sub",
      name: "repo",
    });
  });

  it("marks file:// urls as local", () => {
    const result = parseRepoUrl("file:///tmp/fixtures/demo.git");
    expect(result.ok && result.value).toMatchObject({ local: true, host: "local", name: "demo" });
  });

  it.each([
    ["", "地址为空"],
    ["https://user:token@github.com/a/b", "凭据"],
    ["ftp://example.com/a/b", "协议"],
    ["https://github.com/only-owner", "owner"],
    ["file://relative/path", "绝对路径"],
    ["git@github.com:a/..", "不合法"],
  ])("rejects %j", (input, reason) => {
    const result = parseRepoUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_REPO_URL");
      expect(result.error.message).toContain(reason);
    }
  });
});
