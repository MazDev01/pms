import { defineConfig, devices } from "@playwright/test";

// /scenario harness — ทดสอบเบราว์เซอร์จริง หลาย persona พร้อมกัน (user / UX / UI)
// ใช้ dev server ที่รันอยู่แล้วที่ :3000 (ไม่สตาร์ทเซิร์ฟเวอร์ซ้ำ กัน turbopack cache ชน)
export default defineConfig({
  testDir: "./tests/scenario",
  fullyParallel: true,
  workers: 3, // 3 persona ทำงานพร้อมกัน
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
