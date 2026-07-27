import { defineConfig } from "vitest/config";

// Unit tests (ฟังก์ชันบริสุทธิ์) — คนละชุดกับ Playwright scenario (tests/scenario/*.spec.ts เป็น E2E เบราว์เซอร์จริง)
// จำกัด include ไว้ที่ tests/unit เท่านั้น ไม่ให้ vitest ไปหยิบ spec ของ Playwright มารัน (จะพังเพราะ import @playwright/test)
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
