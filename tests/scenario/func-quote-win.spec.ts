import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import {
  DEALER_ORIGIN, loginUI, watchErrors, assertNoErrors,
  db, waitRow, cleanup, tagged,
} from "./funcHelpers";

// โซ่ธุรกิจหลักของทั้งระบบ: ลีด → ใบเสนอราคา (BOQ) → ปิดการขาย → ลูกค้า
// ทุกขั้นต้องลง DB จริง ไม่ใช่แค่เปลี่ยนบนจอ
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const COMPANY = tagged("โซ่ขาย");

test.beforeAll(async () => { await cleanup(await db(RYG), "RYG"); });
test.afterAll(async () => { await cleanup(await db(RYG), "RYG"); });

test("[func] ออกใบเสนอราคาจากลีด → ใบลง DB พร้อมรายการสินค้า", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);

  // 1) สร้างลีดต้นทาง
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill(COMPANY);
  await page.getByPlaceholder("ชื่อผู้ติดต่อ").fill("คุณโซ่");
  await page.getByPlaceholder("เช่น 1200", { exact: true }).fill("500");   // พื้นที่ → ใช้ตั้งต้น BOQ
  await page.getByRole("button", { name: "บันทึก" }).click();
  await waitRow(sb, "leads", { company: COMPANY });

  // 2) เปิดแผงลีด → แท็บใบเสนอราคา → สร้าง
  await page.getByRole("button", { name: "ตาราง" }).click();
  const row = page.locator("tbody tr").filter({ hasText: COMPANY }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "ดูรายละเอียด" }).first().click();
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: true }).first().click();
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).first().click();
  await expect(page.getByText("สร้างใบเสนอราคาใหม่")).toBeVisible({ timeout: 10_000 });

  // ปุ่มส่งฟอร์มชื่อเดียวกับปุ่มเปิดฟอร์ม — ตัวสุดท้ายในหน้าคือปุ่มในฟอร์ม (อยู่ถัดจาก "ยกเลิก")
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).last().click();

  // 3) ใบต้องอยู่ใน DB ของสาขานี้
  const q = await waitRow<{ id: string; dealer_code: string; status: string; customer: string }>(
    sb, "quotations", { customer: COMPANY });
  expect(q.dealer_code, "ใบใหม่ต้องเป็นของสาขาที่ล็อกอิน").toBe("RYG");
  expect(q.status, "ใบใหม่เริ่มที่ร่าง").toBe("draft");
  expect(q.id, "เลขที่ใบต้องมาจากตัวนับของ DB").toMatch(/^[A-Za-z0-9-]+\d{4}$/);

  assertNoErrors(errs, "ออกใบเสนอราคา");
});

test("[func] ปิดการขายสำเร็จ → ลูกค้าถูกสร้างใน DB", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ตาราง" }).click();

  const row = page.locator("tbody tr").filter({ hasText: COMPANY }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: /▾/ }).first().click();
  await page.getByRole("button", { name: "ปิดการขายสำเร็จ", exact: true }).first().click();

  // ลูกค้าต้องถูกสร้างจากลีด — นี่คือจุดที่ระบบ "แปลงลีดเป็นลูกค้า"
  const cust = await waitRow<{ company: string; dealer_code: string; id: number }>(
    sb, "customers", { company: COMPANY }, 20_000);
  expect(cust.dealer_code, "ลูกค้าต้องเป็นของสาขาเดียวกับลีด").toBe("RYG");
  expect(cust.id, "เลขลูกค้าต้องมาจากตัวนับของ DB").toBeGreaterThan(0);

  assertNoErrors(errs, "ปิดการขาย");
});

test("[func] ลูกค้าที่เกิดจากการปิดการขาย โผล่ในหน้าลูกค้า", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/customers`, { waitUntil: "domcontentloaded" });

  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 20_000, message: "ลูกค้าใหม่ต้องโผล่ในหน้าลูกค้า" }).toContain(COMPANY);

  assertNoErrors(errs, "หน้าลูกค้า");
});

test("[func] เพิ่มโน้ตให้ลูกค้า → โน้ตลง DB", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);
  const TITLE = tagged("โน้ตทดสอบ");

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/customers`, { waitUntil: "domcontentloaded" });

  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 20_000 }).toContain(COMPANY);
  await page.getByText(COMPANY).first().click();

  await page.getByRole("button", { name: "เพิ่มโน้ต" }).first().click();
  await page.getByPlaceholder("หัวข้อโน้ต").fill(TITLE);
  await page.getByPlaceholder("รายละเอียดการติดตาม").fill("บันทึกอัตโนมัติจากชุดทดสอบ");
  await page.getByRole("button", { name: "บันทึกโน้ต" }).click();

  const note = await waitRow<{ title: string; dealer_code: string; customer_id: number }>(
    sb, "customer_notes", { title: TITLE }, 15_000);
  expect(note.dealer_code, "โน้ตต้องเป็นของสาขาที่ล็อกอิน").toBe("RYG");
  expect(note.customer_id, "โน้ตต้องผูกกับลูกค้าที่เปิดอยู่").toBeGreaterThan(0);

  assertNoErrors(errs, "เพิ่มโน้ต");
});
