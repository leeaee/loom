import { defaultRunStore, type RunStore } from "../infra/index";

/** 组合根持有的单例：报告、日志与缓存存储。 */
export function getRunStore(): RunStore {
  return defaultRunStore();
}
