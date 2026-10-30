import { z } from "zod";

/** 解析后的仓库坐标。 */
export const repoRefSchema = z.object({
  url: z.string().describe("规范化后的 https 克隆地址"),
  host: z.string(),
  owner: z.string(),
  name: z.string(),
  ref: z.string().nullable().describe("用户指定的分支、标签或提交；null 表示默认分支"),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});
export type RepoRef = z.infer<typeof repoRefSchema>;

export const languageStatSchema = z.object({ language: z.string(), files: z.number().int().nonnegative() });

/** scout 的输出：不调用模型、只看文件清单得出的仓库概况。 */
export const repoScoutSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  sourceFiles: z.number().int().nonnegative(),
  languages: z.array(languageStatSchema),
  topLevelDirs: z.array(z.object({ name: z.string(), sourceFiles: z.number().int().nonnegative() })),
  manifests: z.array(z.string()).describe("package.json、go.mod、pyproject.toml 等清单文件路径"),
  hasTsconfig: z.boolean(),
  large: z.boolean().describe("源文件数超过阈值时为 true，会先做模块摘要"),
});
export type RepoScout = z.infer<typeof repoScoutSchema>;
