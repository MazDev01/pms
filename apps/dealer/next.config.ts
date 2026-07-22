import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pms/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
