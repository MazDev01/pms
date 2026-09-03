import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests (ฟังก์ชันบริสุทธิ์) — คนละชุดกับ Playwright scenario (tests/scenario/*.spec.ts เป็น E2E เบราว์เซอร์จริง)
// จำกัด include ไว้ที่ tests/unit เท่านั้น ไม่ให้ vitest ไปหยิบ spec ของ Playwright มารัน (จะพังเพราะ import @playwright/test)
export default defineConfig({
  // โมดูลในแอปเรียกกันด้วยชื่อย่อ @pms/shared/... — ต้องบอกทางให้ vitest ด้วย
  // ไม่งั้นเทสต์ที่แตะไฟล์ซึ่ง import แบบนั้นจะล้มตั้งแต่โหลด ("Cannot find package")
  resolve: {
    alias: { "@pms/shared": fileURLToPath(new URL("./packages/shared", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
