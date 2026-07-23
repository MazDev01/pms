import { defineConfig, devices } from "@playwright/test";

// /scenario harness — ทดสอบเบราว์เซอร์จริง หลาย persona พร้อมกัน (user / UX / UI)
// โมโนเรโป: `npm run dev` (turbo) สตาร์ท dealer(:3001) + hq(:3002) · baseURL ตั้งเป็น HQ (:3002)
// เพราะเทสต์ส่วนใหญ่ยิง route /hq/* · เทสต์ dealer-only ให้ใช้ URL เต็ม http://localhost:3001/...
// reuseExistingServer=true → ถ้ามี dev server รันอยู่แล้วใช้ตัวนั้น ไม่สตาร์ทซ้ำ (กัน .next เขียนทับกัน)
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
    baseURL: "http://localhost:3002",
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",       // turbo dev — สตาร์ท dealer(:3001)+hq(:3002)
    url: "http://localhost:3002",  // รอ HQ app พร้อม
    // ⚠️ ห้ามเปิด reuseExistingServer — เคยทำให้ผลเทสต์หลอกมาแล้ว
    //
    // NEXT_PUBLIC_* ถูกฝังลงบันเดิลตอนสตาร์ตเซิร์ฟเวอร์ ไม่ได้อ่านใหม่ตอนรัน
    // ถ้าสลับ NEXT_PUBLIC_DATA_SOURCE ใน .env.local แล้วใช้เซิร์ฟเวอร์ตัวเดิมต่อ
    // เทสต์จะยิงใส่แอปที่ยังเป็นโหมดเก่า → "ผ่าน/ไม่ผ่าน" ไม่ตรงกับสิ่งที่ตั้งใจวัด
    // (เคยหลงสรุปว่าปฏิทินไม่แสดงนัด ทั้งที่กำลังวัดแอปโหมด local ซึ่งอ่านชุดตัวอย่าง)
    //
    // อีกกรณี: รันสองชุดพร้อมกัน ชุดที่จบก่อนจะปิดเซิร์ฟเวอร์ที่อีกชุดใช้อยู่
    // → ERR_CONNECTION_REFUSED กลางคัน
    reuseExistingServer: false,
    timeout: 180_000,            // คอมไพล์ครั้งแรกนานได้
    stdout: "ignore",
    stderr: "pipe",
  },
});
