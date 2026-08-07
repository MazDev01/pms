import type { NextConfig } from "next";
// หัวข้อความปลอดภัยชุดเดียวกันทั้งสองแอป — แก้ที่เดียวมีผลทั้งระบบ
import { securityHeaderRules } from "../../packages/shared/lib/securityHeaders.mjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@pms/shared"],
  eslint: { ignoreDuringBuilds: true },
  // แอป HQ: หน้า login อยู่ที่ /hq/login (ไม่มี /login เปล่า) — ให้ AuthGuard (แชร์) เด้งมาที่นี่แทน /login
  env: { NEXT_PUBLIC_LOGIN_PATH: "/hq/login" },
  // รวมหน้า login เก่า /login/hq (ดีไซน์ dark-stripe) → หน้า HQ ใหม่ /hq/login (split-panel) ให้เหลือดีไซน์เดียว
  async redirects() {
    return [{ source: "/login/hq", destination: "/hq/login", permanent: false }];
  },
  async headers() {
    return securityHeaderRules();
  },
};

export default nextConfig;
