import { test, expect } from "@playwright/test";
import { HQ_ORIGIN, DEALER_ORIGIN } from "./funcHelpers";

// ── หัวข้อความปลอดภัยของหน้าเว็บ ต้องมีครบทั้งสองแอป ────────────────────────────
// เดิมไม่ได้ตั้งอะไรเลย เบราว์เซอร์จึงยอมให้เว็บอื่นเอาหน้าเราไปฝังใน iframe (หลอกให้กดปุ่ม)
// เดาชนิดไฟล์เอง และส่งที่อยู่หน้าจอ (ที่มีรหัสสาขา/เลขที่เอกสาร) ต่อไปเว็บภายนอก
test.setTimeout(120_000);

const REQUIRED: Array<[string, RegExp]> = [
  ["x-frame-options", /DENY/i],
  ["x-content-type-options", /nosniff/i],
  ["referrer-policy", /strict-origin/i],
  ["permissions-policy", /camera=\(\)/i],
  ["content-security-policy-report-only", /frame-ancestors 'none'/i],
];

for (const [name, origin, path] of [
  ["สำนักงานใหญ่", HQ_ORIGIN, "/hq/login"],
  ["ตัวแทน", DEALER_ORIGIN, "/login"],
] as const) {
  test(`หน้าเว็บฝั่ง${name} ต้องมีหัวข้อความปลอดภัยครบ`, async ({ request }) => {
    const res = await request.get(`${origin}${path}`);
    expect(res.status(), `เปิดหน้าได้ (ได้ ${res.status()})`).toBeLessThan(400);
    const headers = res.headers();
    const missing = REQUIRED.filter(([h, re]) => !re.test(headers[h] ?? ""));
    expect(missing.map(m => m[0]),
      `ขาดหัวข้อความปลอดภัย: ${missing.map(m => m[0]).join(", ")} (ที่ได้: ${Object.keys(headers).filter(k => /security|frame|content-type-opt|referrer|permissions/.test(k)).join(", ")})`,
    ).toEqual([]);
  });
}
