import type { NextConfig } from "next";

const loomServerUrl = process.env.LOOM_SERVER_URL ?? "http://localhost:4111";

const nextConfig: NextConfig = {
  // contracts 以 TypeScript 源码形式发布在 workspace 内，需要由 Next 编译。
  transpilePackages: ["@loom/contracts"],
  // 浏览器只访问同源 /mastra/*，由 Next 转发到 Mastra 服务；没有跨域，模型密钥也只在 Mastra 进程。
  async rewrites() {
    return [{ source: "/mastra/:path*", destination: `${loomServerUrl}/:path*` }];
  },
};

export default nextConfig;
