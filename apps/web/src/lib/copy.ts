import type { AgentMode, AnalysisId, RunLogLevel, RunStatus, WorkflowStepId } from "@loom/contracts";

/** 界面上的全部中文文案。组件里不直接写字符串，便于统一修改与将来国际化。 */
export const copy = {
  app: {
    name: "Loom",
    tagline: "同步 Git 仓库，用 Agent 与技能生成 API、数据结构、架构图与技术选型报告",
  },
  newRun: {
    title: "分析一个仓库",
    repoLabel: "Git 地址",
    repoPlaceholder: "https://github.com/owner/repo 或 owner/repo",
    refLabel: "分支 / 标签 / SHA（可选）",
    refPlaceholder: "默认分支",
    force: "忽略缓存重新分析",
    submit: "开始分析",
    submitting: "正在提交…",
    failed: "提交失败",
  },
  recentRuns: {
    title: "最近运行",
    empty: "还没有运行记录",
    loadFailed: "无法读取运行列表，请确认 Mastra 服务已启动（npm run dev）",
    open: "查看",
  },
  runtime: {
    title: "运行环境",
    loadFailed: "无法读取运行环境，请确认 Mastra 服务已启动（npm run dev）",
    mode: { fake: "假模式", real: "真实模式" } satisfies Record<AgentMode, string>,
    modeHint: {
      fake: "不调用大模型：仓库同步与文件扫描真实执行，但 API、数据结构、架构图、技术选型都是内置示例数据，与所分析的仓库无关。用于没有模型密钥时跑通流程。",
      real: "调用下面配置的大模型阅读代码并生成报告。",
    } satisfies Record<AgentMode, string>,
    model: "模型",
    modelUrl: "接口地址",
    modelUrlDefault: "供应商默认地址",
    notSet: "未设置",
    fakeDelay: "模拟耗时",
    dataDir: "数据目录",
    envFile: "配置文件",
    dataLayout: "repos/ 仓库镜像与检出 · runs/<runId>/ 报告与日志 · cache/ 缓存索引 · mastra.db 运行记录",
    howTo:
      "修改方式：编辑上面的配置文件，设置 LOOM_AGENT_MODE=real 与 LOOM_MODEL（如 openai/gpt-5.1、deepseek/deepseek-chat）；" +
      "使用自建或第三方 OpenAI 兼容接口时，再设置 LOOM_MODEL_URL（如 https://api.deepseek.com/v1、http://localhost:11434/v1）" +
      "与 LOOM_MODEL_API_KEY，然后重启 npm run dev。密钥只保存在服务端，界面不会显示。",
  },
  runStatus: {
    pending: "排队中",
    running: "运行中",
    success: "已完成",
    failed: "失败",
    canceled: "已取消",
    suspended: "已暂停",
  } satisfies Record<RunStatus, string>,
  run: {
    back: "返回首页",
    cancel: "取消运行",
    canceling: "正在取消…",
    connecting: "正在连接运行…",
    notFound: "找不到这次运行",
    timeline: "进度",
    details: (logs: number, duration: string | null) =>
      `运行详情：${logs} 条日志${duration ? `，总耗时 ${duration}` : ""}`,
    logs: "运行日志",
    logsEmpty: "还没有日志",
    logsLive: "实时更新中",
    outcome: {
      connecting: "正在连接运行…",
      running: "正在分析",
      runningDetail: (step: string | null, done: number, total: number, elapsed: string | null) =>
        [
          step ? `当前阶段：${step}` : null,
          `已完成 ${done}/${total} 个阶段`,
          elapsed ? `已用时 ${elapsed}` : null,
        ]
          .filter(Boolean)
          .join("；"),
      success: "分析成功",
      successDetail: (analyses: number, duration: string | null) =>
        `${analyses} 项分析全部成功${duration ? `，耗时 ${duration}` : ""}`,
      partial: "部分分析失败",
      partialDetail: (failed: string[], analyses: number) =>
        `${analyses} 项分析中有 ${failed.length} 项失败：${failed.join("、")}。报告已生成，其余结果可正常查看；失败原因见运行日志与报告概览。`,
      failed: "运行失败",
      failedAt: (step: string) => `在「${step}」阶段失败`,
      canceled: "运行已取消",
      canceledDetail: "已完成的步骤保留在下方进度与日志中",
      suspended: "运行已暂停",
      cached: "命中缓存",
      cachedDetail: "同一提交与技能版本的报告已存在，直接复用；如需重新分析，请勾选“忽略缓存重新分析”。",
    },
  },
  logLevel: { info: "信息", warn: "警告", error: "错误" } satisfies Record<RunLogLevel, string>,
  duration: (ms: number) => {
    const seconds = Math.max(0, ms) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)} 分 ${total % 60} 秒`;
  },
  steps: {
    "sync-repo": "同步仓库",
    "scout-repo": "扫描文件",
    digest: "模块摘要",
    analyses: "并行分析",
    advisor: "技术选型顾问",
    render: "生成报告",
  } satisfies Record<WorkflowStepId, string>,
  stepStatus: {
    pending: "等待",
    running: "进行中",
    success: "完成",
    failed: "失败",
    skipped: "跳过",
  },
  report: {
    overview: "概览",
    downloadMarkdown: "下载 Markdown",
    downloadJson: "下载 JSON",
    loadFailed: "无法读取报告",
    contractMismatch: "报告格式与当前合同不一致，可能来自旧版本 Loom。详细信息：",
    missingArtifact: "这一项分析没有产出结果",
    errors: "步骤错误",
    fakeNotice: "这份报告由假模式生成",
    fakeNoticeDetail:
      "除仓库、提交、文件统计与引用核实外，各分析内容都是内置示例数据，与本仓库无关。配置大模型后重新分析才能得到真实结果，配置方法见首页“运行环境”。",
    citations: "引用核实",
    unverified: "未核实的引用",
    unverifiedHint: "文件不存在或行号超出范围",
    mermaidFailed: "架构图渲染失败，下面是原始 Mermaid 文本：",
    empty: "无",
    meta: {
      repo: "仓库",
      commit: "提交",
      createdAt: "生成时间",
      mode: "模式",
      files: "文件 / 源文件",
      languages: "语言",
      digests: "模块摘要",
    },
    columns: {
      kind: "类型",
      method: "方法",
      name: "名称",
      signature: "签名",
      description: "说明",
      location: "位置",
      field: "字段",
      type: "类型",
      category: "类别",
      choice: "现状",
      assessment: "评价",
    },
    architecture: { diagram: "架构图", components: "组件", flows: "关键流程" },
    dataModel: { relations: "关系", optional: "可选" },
    techChoice: {
      current: "现有技术栈",
      recommendations: "建议",
      rationale: "依据",
      alternatives: "备选方案",
      confidence: { high: "高置信", medium: "中置信", low: "低置信" },
    },
  },
  analyses: {
    "api-surface": "API",
    "data-model": "数据结构",
    "architecture-flow": "架构图",
    "tech-choice": "技术选型",
  } satisfies Record<AnalysisId, string>,
} as const;
