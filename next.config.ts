import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/english",
        destination: "/vocabulary",
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
