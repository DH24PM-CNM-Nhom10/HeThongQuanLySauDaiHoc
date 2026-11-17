import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Khong proxy API xac thuc va thong bao do Next.js tu xu ly.
        // Cac endpoint nghiep vu khac giu backend NestJS o cong 3001.
        source: "/api/:path((?!auth(?:/|$)|thong-bao(?:/|$)).*)",
        destination: "http://localhost:3001/api/:path",
      },
    ];
  },
};

export default nextConfig;
