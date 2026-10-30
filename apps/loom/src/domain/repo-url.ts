import { fail, LoomError, ok, type Result } from "./errors";

export type ParsedRepoUrl = {
  /** 交给 git 的克隆地址；https 统一以 .git 结尾 */
  url: string;
  host: string;
  owner: string;
  name: string;
  /** 本地 file:// 仓库（只在 LOOM_ALLOW_LOCAL_REPOS=true 时允许） */
  local: boolean;
};

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const HOST = /^[A-Za-z0-9.-]+(:\d+)?$/;

function invalid(input: string, reason: string) {
  return fail(new LoomError("INVALID_REPO_URL", `无法识别的 Git 地址「${input}」：${reason}`));
}

function fromSegments(input: string, host: string, rawSegments: string[]): Result<ParsedRepoUrl> {
  const segments = rawSegments.filter(Boolean);
  if (segments.length < 2) return invalid(input, "需要 <owner>/<name>");
  const last = segments.at(-1) ?? "";
  const name = last.replace(/\.git$/, "");
  const ownerSegments = segments.slice(0, -1);
  if (!HOST.test(host)) return invalid(input, "主机名不合法");
  for (const segment of [...ownerSegments, name]) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..") {
      return invalid(input, `路径片段「${segment}」不合法`);
    }
  }
  const owner = ownerSegments.join("/");
  return ok({
    url: `https://${host}/${owner}/${name}.git`,
    host: host.toLowerCase(),
    owner,
    name,
    local: false,
  });
}

/**
 * 解析用户输入的仓库地址。支持：
 * `owner/name`（默认 GitHub）、`https://host/owner/name(.git)`、`git@host:owner/name.git`、
 * `ssh://git@host/owner/name.git`、`file:///abs/path/repo.git`。
 * ssh 地址会转成 https，令牌只通过 http.extraHeader 注入，不写进 URL。
 */
export function parseRepoUrl(raw: string): Result<ParsedRepoUrl> {
  const input = raw.trim();
  if (!input) return invalid(raw, "地址为空");

  if (input.startsWith("file://")) {
    const path = decodeURIComponent(input.slice("file://".length));
    if (!path.startsWith("/") || path.split("/").includes(".."))
      return invalid(input, "file:// 需要绝对路径");
    const name = (path.split("/").filter(Boolean).at(-1) ?? "").replace(/\.git$/, "");
    if (!SEGMENT.test(name)) return invalid(input, "仓库目录名不合法");
    return ok({ url: `file://${path}`, host: "local", owner: "local", name, local: true });
  }

  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(input);
  if (scp?.[1] && scp[2]) return fromSegments(input, scp[1], scp[2].split("/"));

  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(input)) {
    return fromSegments(input, "github.com", input.split("/"));
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return invalid(input, "不是合法的 URL");
  }
  if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol)) {
    return invalid(input, `不支持的协议 ${url.protocol}`);
  }
  if (url.username || url.password) {
    if (url.protocol !== "ssh:") return invalid(input, "地址中不能包含凭据，私有仓库请配置 GITHUB_TOKEN");
  }
  const segments = url.pathname.split("/");
  const treeIndex = segments.indexOf("tree");
  return fromSegments(input, url.host, treeIndex > 0 ? segments.slice(0, treeIndex) : segments);
}
