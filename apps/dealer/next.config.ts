import type { NextConfig } from "next";
// หัวข้อความปลอดภัยชุดเดียวกันทั้งสองแอป — แก้ที่เดียวมีผลทั้งระบบ
import { securityHeaderRules } from "../../packages/shared/lib/securityHeaders.mjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@pms/shared"],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return securityHeaderRules();
  },
};

export default nextConfig;
