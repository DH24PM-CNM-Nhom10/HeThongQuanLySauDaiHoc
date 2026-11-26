import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { proxyClientMaxBodySize: '20mb' },
  turbopack: { root: path.resolve(__dirname, "..") },
  async rewrites() {
    return [
      {
        // Next.js xử lý xác thực, thông báo, học viên và tải Excel.
        // Cac endpoint nghiep vu khac giu backend NestJS o cong 3001.
        source: "/api/:path((?!auth(?:/|$)|thong-bao(?:/|$)|students(?:/|$)|teachers(?:/|$)|schedule(?:/|$)|academic(?:/|$)|courses(?:/|$)|upload$|stats$|warnings$|export$|clear$|reset$|catalogs$).*)",
        destination: "http://localhost:3001/api/:path",
      },
    ];
  },
};

export default nextConfig;
