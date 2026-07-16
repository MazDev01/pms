import { defineConfig, devices } from "@playwright/test";

// /scenario harness — ทดสอบเบราว์เซอร์จริง หลาย persona พร้อมกัน (user / UX / UI)
// ถ้ามี dev server ที่ :3000 อยู่แล้วจะใช้ตัวนั้น (reuseExistingServer) ถ้าไม่มีจะสตาร์ทให้เอง
// ห้ามรันหลายเซิร์ฟเวอร์พร้อมกันบนโปรเจกต์เดียว — เขียน .next ทับกันแล้วพังทั้งคู่ (ENOENT _buildManifest)
export default defineConfig({
  testDir: "./tests/scenario",
  // เก็บ artifact ไว้ใน node_modules/.cache — ที่เดิม (test-results/) อยู่ในโปรเจกต์
  // ทุกครั้งที่เทสต์เขียนไฟล์ dev server จะเห็นไฟล์เปลี่ยนแล้ว recompile ทั้งหน้า → เทสต์เจอ 404 กลางคัน
  outputDir: "node_modules/.cache/playwright-results",
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
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,   // มีเซิร์ฟเวอร์อยู่แล้ว = ใช้ตัวนั้น ไม่สตาร์ทซ้ำ
    timeout: 180_000,            // คอมไพล์ครั้งแรกนานได้
    stdout: "ignore",
    stderr: "pipe",
  },
});
