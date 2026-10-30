import type { NextConfig } from "next";

const loomServerUrl = process.env.LOOM_SERVER_URL ?? "http://localhost:4111";

const nextConfig: NextConfig = {
  // contracts 以 TypeScript 源码形式发布在 workspace 内，需要由 Next 编译。
  transpilePackages: ["@loom/contracts"],
  // Next 的 gzip 会把转发的工作流事件流缓冲到运行结束才发出，进度就不再实时；本机单用户场景不需要压缩。
  compress: false,
  // 浏览器只访问同源 /mastra/*，由 Next 转发到 Mastra 服务；没有跨域，模型密钥也只在 Mastra 进程。
  async rewrites() {
    return [{ source: "/mastra/:path*", destination: `${loomServerUrl}/:path*` }];
  },
};

export default nextConfig;
