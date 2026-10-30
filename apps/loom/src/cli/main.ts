import { parseArgs } from "node:util";
import { ANALYZE_WORKFLOW_ID, analyzeInputSchema } from "@loom/contracts";
import { mastra } from "../mastra/index";
import { getRunStore } from "../mastra/runtime";

const USAGE = `用法：npm run cli -w @loom/server -- analyze <git-url> [--ref <分支|标签|SHA>] [--force]

示例：
  npm run cli -w @loom/server -- analyze vercel/ms
  LOOM_AGENT_MODE=fake npm run cli -w @loom/server -- analyze https://github.com/vercel/ms --force`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ref: { type: "string" },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, repoUrl] = positionals;
  if (values.help || command !== "analyze" || !repoUrl) {
    console.info(USAGE);
    return values.help ? 0 : 1;
  }

  const inputData = analyzeInputSchema.parse({ repoUrl, ref: values.ref, force: values.force });
  const run = await mastra.getWorkflow(ANALYZE_WORKFLOW_ID).createRun();
  console.info(`运行 ${run.runId}：开始分析 ${inputData.repoUrl}`);
  const result = await run.start({ inputData });

  if (result.status !== "success") {
    const reason = result.status === "failed" ? result.error?.message : result.status;
    console.error(`分析未完成（${result.status}）：${reason ?? "未知原因"}`);
    return 1;
  }
  const { runId, cached, reportPath } = result.result;
  const report = await getRunStore().readReport(runId);
  console.info(`${cached ? "命中缓存" : "分析完成"}：${reportPath}`);
  console.info(
    `引用核实 ${report.citationCheck.verified}/${report.citationCheck.total}，错误 ${report.errors.length} 个`,
  );
  for (const error of report.errors) console.warn(`  - ${error.step}：${error.message}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
