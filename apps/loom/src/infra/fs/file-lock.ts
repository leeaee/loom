import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { LoomError } from "../../domain/index";

export type FileLockOptions = {
  /** 等待锁的最长时间 */
  timeoutMs?: number;
  /** 锁文件超过该时长视为上次进程崩溃遗留，直接清除 */
  staleMs?: number;
  pollMs?: number;
};

/** 跨进程互斥：用 O_EXCL 创建锁文件，完成后删除。同一仓库的同步操作串行执行。 */
export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  options: FileLockOptions = {},
): Promise<T> {
  const { timeoutMs = 10 * 60_000, staleMs = 30 * 60_000, pollMs = 200 } = options;
  await mkdir(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
      await handle.close();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > staleMs) {
        await rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() > deadline) throw new LoomError("LOCK_TIMEOUT", `等待锁超时：${lockPath}`);
      await sleep(pollMs);
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockPath, { force: true });
  }
}
