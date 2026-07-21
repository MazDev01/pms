import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pms/shared"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
