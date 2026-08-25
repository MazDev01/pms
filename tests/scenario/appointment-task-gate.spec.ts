import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ─── งาน "นัดหมาย" ในรายการสิ่งที่ต้องทำ ────────────────────────────────────────
// ติ๊กเองไม่ได้ถ้ายังไม่มีนัดจริง — ต้องพาไปลงนัดก่อน แล้วระบบค่อยติ๊กให้เอง
// (บอสทัก 25 ส.ค. 69: กดติ๊กแล้วไม่มีอะไรเกิดขึ้น เพราะฟอร์มไปเปิดในแท็บที่ยังไม่ได้เปิดดู)

test("[func·dealer] ติ๊กงานนัดหมายทั้งที่ยังไม่มีนัด → ต้องพาไปฟอร์มลงนัด และช่องต้องไม่ติ๊ก", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "ตาราง" }).click();

  // หาลูกค้าเป้าหมายที่ยังไม่มีนัด — เปิดรายละเอียดทีละรายจนเจองานนัดหมายที่ยังไม่ติ๊ก
  // ⚠️ ต้องกด "ปุ่มงาน" ในรายการสิ่งที่ต้องทำ ไม่ใช่แท็บที่ชื่อ "นัดหมาย" เหมือนกันเป๊ะ
  //    (กดผิดตัวแล้วฟอร์มก็โผล่เหมือนกัน เทสต์จะผ่านทั้งที่ไม่ได้วัดอะไรเลย)
  const งานนัด = page.getByRole("button", { name: "นัดหมาย", exact: true }).last();
  let เจอ = false;
  const จำนวนแถว = Math.min(5, await page.getByRole("button", { name: "ดูรายละเอียด" }).count());
  for (let i = 0; i < จำนวนแถว; i++) {
    await page.getByRole("button", { name: "ดูรายละเอียด" }).nth(i).click();
    // รายการสิ่งที่ต้องทำอยู่ในแท็บ "งาน" — ลิ้นชักเปิดมาที่ภาพรวมก่อนเสมอ
    await page.getByRole("button", { name: "งาน", exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    if (await งานนัด.isVisible().catch(() => false)) { เจอ = true; break; }
    await page.keyboard.press("Escape");
  }
  test.skip(!เจอ, "ไม่พบงานนัดหมายในลูกค้าเป้าหมาย 5 รายแรก");
  await งานนัด.click();

  // ต้องบอกเหตุผลก่อน (แถบเตือนหายเองใน 2-3 วิ จึงต้องเช็กก่อนอย่างอื่น)
  await expect(page.getByText(/ลงนัดหมายจริงก่อน/)).toBeVisible({ timeout: 5_000 });
  // แล้วต้องพาไปที่ฟอร์มลงนัดจริง (ช่องประเภทนัดหมายต้องโผล่มาให้กรอก)
  await expect(page.getByLabel("ประเภทนัดหมาย")).toBeVisible({ timeout: 10_000 });
  // ช่องงานนัดหมายต้องยังไม่ถูกติ๊ก — ติ๊กได้ต่อเมื่อมีนัดจริงเท่านั้น
  const ติ๊กแล้ว = await page.locator('input[type="checkbox"]:checked').count();
  expect(ติ๊กแล้ว, "ยังไม่มีนัดจริง ห้ามติ๊กงานให้").toBe(0);
});
