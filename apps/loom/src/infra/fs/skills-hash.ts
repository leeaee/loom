import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { type HashEntry, hashEntries } from "../../domain/index";

async function collect(dir: string, root: string, out: HashEntry[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) await collect(abs, root, out);
    else if (entry.isFile())
      out.push({ path: relative(root, abs).split("\\").join("/"), content: await readFile(abs) });
  }
}

/** 运行时技能目录的内容哈希；技能一改，缓存自然失效。 */
export async function hashSkillsDir(skillsDir: string): Promise<string> {
  const entries: HashEntry[] = [];
  await collect(skillsDir, skillsDir, entries);
  return hashEntries(entries);
}

/** 技能目录下所有含 SKILL.md 的子目录名。 */
export async function listSkillNames(skillsDir: string): Promise<string[]> {
  const names: string[] = [];
  for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const files = await readdir(join(skillsDir, entry.name));
    if (files.includes("SKILL.md")) names.push(entry.name);
  }
  return names.sort();
}
