import type { NextConfig } from "next";

const nextConfig: NextConfig = {
<<<<<<< HEAD
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
=======
  /* config options here */
};

export default nextConfig;
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d
