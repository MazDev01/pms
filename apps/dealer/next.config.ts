import type { NextConfig } from "next";
// หัวข้อความปลอดภัยชุดเดียวกันทั้งสองแอป — แก้ที่เดียวมีผลทั้งระบบ
import { securityHeaderRules } from "../../packages/shared/lib/securityHeaders.mjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@pms/shared"],
  // ไม่ประกาศชนิดเซิร์ฟเวอร์ให้คนภายนอกรู้ (ตรวจพบ 27 ส.ค. 69) — ลดข้อมูลตั้งต้นให้คนที่ไล่หาช่องโหว่
  poweredByHeader: false,

  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return securityHeaderRules();
  },
};

export default nextConfig;
