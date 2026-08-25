import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ─── แถบตัวกรองต้องอยู่บรรทัดเดียว (บอสสั่ง 25 ส.ค. 69) ─────────────────────────
// หน้าใบเสนอราคาทั้งเครือเคยตกบรรทัด — "ทุกสถานะ" หล่นไปอยู่บรรทัดสองคนเดียว
// วัดจาก "ตำแหน่งบนของชิ้นส่วนในแถบ" ไม่ใช่ความสูง เพราะความสูงเปลี่ยนตามขนาดฟอนต์ได้

for (const [ชื่อ, path] of [
  ["ใบเสนอราคาทั้งเครือ", "/hq/quotations"],
  ["ลูกค้าทั้งเครือ", "/hq/customers"],
] as const) {
  test(`[ui·hq] แถบตัวกรองหน้า${ชื่อ} อยู่บรรทัดเดียว`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, "hq", path);
    const แถบ = page.locator(".hq-sticky-filter").first();
    await expect(แถบ).toBeVisible();
    // ข้ามตัวคั่นช่องว่าง (div เปล่า flex:1 สูง 0) — มันถูกจัดกลางแนวตั้ง ตำแหน่งบนจึงไม่เท่าช่องอื่น
    // ทั้งที่ไม่ใช่ของที่มองเห็น ถ้าไม่ข้ามจะนับเป็น "อีกบรรทัด" ทั้งที่หน้าจอปกติดี
    const ตำแหน่งบน = await แถบ.locator("> *").evaluateAll(els =>
      els.map(e => e.getBoundingClientRect())
         .filter(r => r.height > 4 && r.width > 4)
         .map(r => Math.round(r.top)));
    const จำนวนแถว = new Set(ตำแหน่งบน).size;
    expect(จำนวนแถว, `แถบตัวกรองต้องอยู่บรรทัดเดียว (ตอนนี้ ${จำนวนแถว} บรรทัด)`).toBe(1);
  });
}
