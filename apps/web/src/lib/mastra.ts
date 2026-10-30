import { ANALYZE_WORKFLOW_ID } from "@loom/contracts";
import { MastraClient } from "@mastra/client-js";

/** 同源前缀；next.config 把 /mastra/* 转发到 Mastra 服务。 */
export const MASTRA_PREFIX = "/mastra";

let client: MastraClient | undefined;

function getClient(): MastraClient {
  if (!client) {
    const origin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
    client = new MastraClient({ baseUrl: `${origin}${MASTRA_PREFIX}` });
  }
  return client;
}

export function analyzeWorkflow() {
  return getClient().getWorkflow(ANALYZE_WORKFLOW_ID);
}
