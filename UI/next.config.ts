import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*", // Chuyển toàn bộ request /api sang NestJS
      },
    ];
  },
};

export default nextConfig;