import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Next.js xử lý xác thực, thông báo, học viên và tải Excel.
        // Cac endpoint nghiep vu khac giu backend NestJS o cong 3001.
        source: "/api/:path((?!auth(?:/|$)|thong-bao(?:/|$)|students$|students/advisors$|upload$).*)",
        destination: "http://localhost:3001/api/:path",
      },
    ];
  },
};

export default nextConfig;
