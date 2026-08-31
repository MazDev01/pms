import { test, expect } from "@playwright/test";
import { open, settle } from "./helpers";
// ── กันของหายเงียบตอนเพิ่มแม่แบบ (เจอจริง 31 ส.ค. 69) ─────────────────────────────
// เดิมกดบันทึกแล้วกล่องปิดทันทีทั้งที่คำขอยังไม่จบ · รีเฟรช/ปิดแท็บตอนนั้น = แม่แบบไม่ถูกสร้างเลย
// และไม่มีข้อความผิดพลาดใด ๆ เพราะหน้าถูกทิ้งไปก่อนที่ error จะกลับมา
const ฐาน = `ZZFIX-${Date.now()}`;

test("[hq] กดบันทึกแม่แบบ — กล่องต้องยังไม่ปิดจนกว่าจะบันทึกเสร็จ", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page, "hq", "/hq/master"); await settle(page);

  await page.getByRole("button", { name: /^เพิ่มแม่แบบ$/ }).click();
  await page.getByPlaceholder("เช่น โกดังสำเร็จรูป").fill(`${ฐาน}-a`);
  await page.getByLabel("ราคากลาง (บาท)").first().fill("3001");

  // ทำให้คำขอบันทึกช้าลง เพื่อจับสถานะ "กำลังบันทึก…" ให้ทัน
  await page.route("**/rest/v1/master_catalog*", async route => {
    await new Promise(r => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole("button", { name: /^บันทึก$/ }).click();
  await expect(page.getByRole("button", { name: /กำลังบันทึก…/ })).toBeVisible({ timeout: 5_000 });
  // กล่องยังเปิดอยู่ระหว่างบันทึก
  await expect(page.getByPlaceholder("เช่น โกดังสำเร็จรูป")).toBeVisible();
  // บันทึกเสร็จแล้วกล่องปิดเอง
  await expect(page.getByPlaceholder("เช่น โกดังสำเร็จรูป")).toHaveCount(0, { timeout: 20_000 });
  await page.unroute("**/rest/v1/master_catalog*");
  await expect(page.getByText(`${ฐาน}-a`, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // เก็บกวาด — ลบแม่แบบทดสอบทิ้ง
  const แถว = page.locator("tr", { hasText: `${ฐาน}-a` }).first();
  await แถว.getByTitle("ลบ").click().catch(() => {});
  await page.getByRole("button", { name: /^ลบ/ }).last().click().catch(() => {});
  await page.waitForTimeout(1500);
});
