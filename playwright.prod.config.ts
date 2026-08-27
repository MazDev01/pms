import { defineConfig, devices } from "@playwright/test";

// ── ชุดตรวจ "เว็บใช้งานจริง" — ไม่สตาร์ทเซิร์ฟเวอร์ในเครื่อง ยิงไปที่เว็บจริงตรง ๆ ──
// ใช้: npm run smoke:prod
// ⚠️ อ่านอย่างเดียว ห้ามให้ชุดนี้สร้าง/แก้/ลบข้อมูลบนเว็บจริง
export default defineConfig({
  testDir: "./tests/prod-smoke",
  outputDir: "node_modules/.cache/playwright-prod",
  fullyParallel: false,
  workers: 2,
  retries: 1,           // เน็ตสะดุดชั่วครู่ไม่ควรทำให้ทั้งชุดแดง · บั๊กจริงล้มทั้งสองครั้ง
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 45_000,   // เว็บจริงอยู่ไกลกว่าเครื่องตัวเอง
    ...devices["Desktop Chrome"],
  },
});
