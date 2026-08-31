import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ── โมดัลต้องใช้คีย์บอร์ดได้จริง ────────────────────────────────────────────────
//
// คนที่ใช้คีย์บอร์ดอย่างเดียว (หรือโปรแกรมอ่านหน้าจอ) เจอปัญหาเดิม 3 อย่าง:
//   • กด Escape ปิดโมดัลไม่ได้ ต้องเล็งเมาส์ไปคลิก X เท่านั้น
//   • กด Tab แล้วโฟกัสหลุดออกไปอยู่กับปุ่มที่อยู่ "ข้างหลัง" โมดัล — กดของที่มองไม่เห็น
//   • ปิดโมดัลแล้วโฟกัสหายไปต้นหน้า ต้อง Tab ไล่ใหม่ทั้งหน้า
test.setTimeout(120_000);

test("[a11y] ลิ้นชักใบเสนอราคาฝั่ง HQ — Esc ปิดได้ และ Tab ไม่หลุดออกนอกลิ้นชัก", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  // แถวเปิดด้วยปุ่ม "ดู" ที่อยู่ในแถว (ClickableRow ก็เปิดได้ แต่ปุ่มชัดเจนกว่าและไม่ชนกับปุ่มอื่นในแถว)
  // ⚠️ ต้อง exact — ตารางอันดับตัวแทนบนหน้าเดียวกันมีปุ่มชื่อ "ดูรายละเอียดตัวแทน"
  //    ซึ่งชื่อขึ้นต้นเหมือนกัน ถ้าไม่ระบุ exact จะไปกดปุ่มนั้นแล้วเด้งออกจากหน้านี้
  //    (hq-quotations.spec.ts เตือนกับดักนี้ไว้แล้ว)
  const viewBtn = page.getByRole("button", { name: "ดูรายละเอียด", exact: true }).first();
  await viewBtn.waitFor({ state: "visible", timeout: 30_000 });
  await viewBtn.click();

  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, "กดปุ่มดูแล้วต้องเปิดลิ้นชัก").toBeVisible({ timeout: 15_000 });
  await expect(dialog, "ลิ้นชักต้องประกาศตัวเป็นหน้าต่างซ้อน (aria-modal) ให้โปรแกรมอ่านหน้าจอรู้")
    .toHaveAttribute("aria-modal", "true");

  // โฟกัสต้องอยู่ในลิ้นชักตั้งแต่เปิด ไม่ใช่ค้างอยู่ข้างหลัง
  await expect.poll(async () => dialog.evaluate((el, ) => el.contains(document.activeElement)),
    { timeout: 5_000, message: "เปิดโมดัลแล้วโฟกัสต้องย้ายเข้ามาในโมดัล" }).toBe(true);

  // กด Tab หลายครั้ง โฟกัสต้องยังวนอยู่ข้างใน
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate(el => el.contains(document.activeElement)),
    "กด Tab วนแล้วโฟกัสต้องไม่หลุดออกไปนอกโมดัล").toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog, "กด Escape ต้องปิดโมดัลได้").toBeHidden({ timeout: 10_000 });
});

test("[a11y] โมดัลเพิ่มผู้ใช้ HQ — Esc ปิดได้", async ({ page }) => {
  await open(page, "hq", "/hq/users");
  const addBtn = page.getByRole("button", { name: "เพิ่มผู้ใช้งาน HQ" }).first();
  await addBtn.waitFor({ state: "visible", timeout: 30_000 });
  await addBtn.click();

  const dialog = page.getByRole("dialog", { name: "ฟอร์มผู้ใช้ HQ" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(dialog, "กด Escape ต้องปิดฟอร์มได้").toBeHidden({ timeout: 10_000 });
});

test("[a11y] ฟอร์มข้อมูลตัวแทน (HQ) — Esc ปิดได้ และประกาศตัวเป็นหน้าต่างซ้อน", async ({ page }) => {
  await open(page, "hq", "/hq/dealers");
  const addBtn = page.getByRole("button", { name: /เพิ่มตัวแทน/ }).first();
  await addBtn.waitFor({ state: "visible", timeout: 30_000 });
  await addBtn.click();

  const dialog = page.getByRole("dialog", { name: "ฟอร์มข้อมูลตัวแทน" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(dialog, "กด Escape ต้องปิดฟอร์มได้").toBeHidden({ timeout: 10_000 });
});

test("[a11y] หน้าต่างดูตัวอย่างไฟล์ (ตัวแทน) — Esc ปิดได้", async ({ page }) => {
  await open(page, "dealer", "/files");
  // ปุ่มรูปตาถูกเอาออกแล้ว (28 ส.ค. 69) — เปิดตัวอย่างด้วยการกดที่แถวไฟล์แทน
  const row = page.locator('tr[aria-label^="เปิดรายละเอียดไฟล์"]').first();
  await expect(row, "หน้าไฟล์ต้องมีไฟล์ให้เปิดดูอย่างน้อย 1 รายการ").toBeVisible({ timeout: 15_000 });
  await row.click();

  const dialog = page.getByRole("dialog", { name: "ดูตัวอย่างไฟล์" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(dialog, "กด Escape ต้องปิดหน้าต่างดูไฟล์ได้").toBeHidden({ timeout: 10_000 });
});

test("[a11y] หัวคอลัมน์เรียงลำดับ — กดด้วยคีย์บอร์ดได้ และบอกทิศทางการเรียง", async ({ page }) => {
  // เดิมเป็น <th onClick> เฉย ๆ: Tab ไปไม่ถึง (คนใช้คีย์บอร์ดเรียงตารางไม่ได้เลย)
  // และโปรแกรมอ่านหน้าจอไม่รู้ว่าตอนนี้เรียงจากมากไปน้อยหรือน้อยไปมาก
  await open(page, "dealer", "/quotations");
  const sortBtn = page.getByRole("button", { name: /^เรียงตาม/ }).first();
  await sortBtn.waitFor({ state: "visible", timeout: 30_000 });

  const th = page.locator("th").filter({ has: sortBtn }).first();
  const before = await th.getAttribute("aria-sort");
  expect(before, "หัวคอลัมน์ต้องประกาศสถานะการเรียง (aria-sort)").not.toBeNull();

  // กดด้วยคีย์บอร์ดล้วน — โฟกัสแล้วกด Enter ต้องสลับทิศทางได้จริง
  await sortBtn.focus();
  expect(await sortBtn.evaluate(el => el === document.activeElement),
    "หัวคอลัมน์ต้องโฟกัสด้วยคีย์บอร์ดได้").toBe(true);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);

  const after = await th.getAttribute("aria-sort");
  expect(after, `กด Enter แล้วทิศทางการเรียงต้องเปลี่ยน (ก่อน=${before} หลัง=${after})`).not.toBe(before);
});
