import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "date-fns"],
  },
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
