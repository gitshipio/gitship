import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/console',
        destination: 'http://localhost:3001/api/console',
      },
    ]
  },
};

export default nextConfig;
