import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// ── ชุดทดสอบบน Safari จริง (WebKit) สำหรับผู้ใช้ iPhone / iPad ────────────────
// ใช้: npm run test:mobile        (โหมดปกติ)
//      npm run test:api -- -c playwright.mobile.config.ts   (โหมดเดียวกับเว็บจริง)
//
// ทำไมแยกไฟล์: ใน playwright.config.ts ชุด safari ตั้งให้ "รอชุด Chrome จบก่อน" (dependencies)
//   ซึ่งถูกตอนรันตรวจรับทั้งระบบ แต่ทำให้สั่งตรวจเฉพาะมือถืออย่างเดียวไม่ได้เลย
//   (ต้องรอชุดใหญ่ 18 นาทีก่อนทุกครั้ง) — ไฟล์นี้ตัดเงื่อนไขนั้นออกอย่างเดียว ไม่ได้ลดความเข้ม
//
// iPhone/iPad ใช้เอนจิน WebKit ซึ่งต่างจาก Chrome จริงในจุดที่พังได้: ฟอนต์ · flex/grid ·
//   position:sticky · การอ่านวันที่ · ความสูงจอที่แถบเบราว์เซอร์กินพื้นที่
export default defineConfig({
  ...base,
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"] },      testMatch: /mobile-viewport\.spec\.ts/ },
    { name: "ipad",   use: { ...devices["iPad (gen 7)"] },   testMatch: /mobile-viewport\.spec\.ts/ },
  ],
});
