import { test, expect } from "@playwright/test";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import {
  HQ_ORIGIN, DEALER_ORIGIN, loginUI, watchErrors, assertNoErrors,
  db, waitRow, waitGone, TAG,
} from "./funcHelpers";

// ฝั่งสำนักงานใหญ่ — ข้อมูลกลางที่ทั้งเครือใช้ร่วมกัน
// รวมถึงบทพิสูจน์สำคัญที่สุดของโมเดล: HQ แก้ที่ :3002 แล้วตัวแทนที่ :3001 เห็นตาม
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const CODE = "ZZT";                      // รหัสสาขาทดสอบ (ไม่ชนของจริง 10 สาขา)
const DEALER_NAME = `${TAG}-สาขาทดสอบ`;

test.beforeAll(async () => {
  const sb = await db(ADMIN);
  await sb.from("dealers").delete().eq("code", CODE);
  await sb.from("master_catalog").delete().like("name", `%${TAG}%`);
});
test.afterAll(async () => {
  const sb = await db(ADMIN);
  await sb.from("dealers").delete().eq("code", CODE);
  await sb.from("master_catalog").delete().like("name", `%${TAG}%`);
});

test("[func·hq] เพิ่มตัวแทนผ่านหน้าจอ → ลง DB", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);

  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  // รอจน "สาขาจริงจาก DB" ขึ้นก่อน — แถวในตารางอย่างเดียวเชื่อไม่ได้ (เรนเดอร์ก่อนโหลดจบ)
  // ถ้ากดเพิ่มก่อนทะเบียนโหลดจบ การแก้จะถูกผลการโหลดทับ (ดูคำอธิบายใน useRepoState)
  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 25_000, message: "ทะเบียนตัวแทนต้องโหลดเสร็จก่อน" }).toContain("ระยองสตีลเวิร์คส์");
  await page.getByRole("button", { name: "เพิ่มตัวแทน" }).first().click();

  await page.getByPlaceholder("เช่น BKK").fill(CODE);
  await page.getByPlaceholder("บจ. ตัวอย่างสตีล...").fill(DEALER_NAME);
  await page.getByPlaceholder("เช่น ระยอง").fill("ระยอง");
  await page.getByRole("button", { name: "สร้างตัวแทน" }).click();

  const row = await waitRow<{ code: string; name: string }>(sb, "dealers", { code: CODE });
  expect(row.name, "ชื่อสาขาต้องตรงกับที่กรอก").toBe(DEALER_NAME);

  assertNoErrors(errs, "เพิ่มตัวแทน");
});

test("[func·hq] สาขาที่เพิ่งเพิ่ม โผล่ในตัวกรองของหน้าอื่นทันที", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);

  // ทะเบียนตัวแทนเป็นแหล่งเดียวของทุกหน้า — สาขาใหม่ต้องไม่ตกหล่นที่ไหน
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 20_000, message: "หน้าตัวแทนต้องเห็นสาขาใหม่" }).toContain(DEALER_NAME);

  assertNoErrors(errs, "สาขาใหม่ในหน้าอื่น");
});

test("[func·hq] ลบตัวแทนผ่านหน้าจอ → หายจาก DB จริง", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);

  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });

  const row = page.locator("tbody tr").filter({ hasText: DEALER_NAME }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  page.once("dialog", d => d.accept()); // ยืนยันการลบ
  await row.getByTitle(/ลบ/).first().click();

  await waitGone(sb, "dealers", { code: CODE }, 20_000);
  assertNoErrors(errs, "ลบตัวแทน");
});

test("[func·hq→dealer] HQ เพิ่มแม่แบบในแคตตาล็อกกลาง → ตัวแทนเห็น", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const PRODUCT = `${TAG}-แม่แบบทดสอบ`;

  // เพิ่มผ่าน repo ฝั่ง HQ (ฟอร์มแคตตาล็อกมีหลายช่อง — ที่ต้องพิสูจน์คือ "ถึงตัวแทนไหม")
  const ins = await sb.from("master_catalog")
    .insert({ id: "zzt-test", name: PRODUCT, price: 9999, unit: "ตร.ม." }).select();
  expect(ins.error, `HQ เพิ่มแม่แบบไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();

  try {
    // ตัวแทนคนละ origin (:3001) — ถ้ายังเป็นโหมด local จะไม่มีทางเห็นเลย
    await loginUI(page, DEALER_ORIGIN, "/login", RYG);
    await page.goto(`${DEALER_ORIGIN}/products`, { waitUntil: "domcontentloaded" });
    await expect.poll(async () => page.evaluate(() => document.body.innerText),
      { timeout: 20_000, message: "ตัวแทนต้องเห็นแม่แบบที่ HQ เพิ่งเพิ่ม" }).toContain(PRODUCT);

    assertNoErrors(errs, "แคตตาล็อกถึงตัวแทน");
  } finally {
    await sb.from("master_catalog").delete().eq("id", "zzt-test");
  }
});

test("[func·hq→dealer] HQ เปลี่ยน VAT → ตัวแทนใช้ค่าใหม่ทันที", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const { data: before } = await sb.from("hq_policy").select("vat").eq("id", 1).maybeSingle();
  const origVat = (before?.vat as number) ?? 7;
  const newVat = origVat === 7 ? 10 : 7;

  try {
    // HQ เปลี่ยนอัตราภาษีของทั้งเครือ
    const up = await sb.from("hq_policy").update({ vat: newVat }).eq("id", 1).select();
    expect(up.error, `HQ แก้ VAT ไม่ได้: ${JSON.stringify(up.error)}`).toBeNull();

    // ตัวแทนต้องเห็นค่าใหม่ที่หน้าตั้งค่า (ช่องติดกุญแจ + ป้าย HQ)
    await loginUI(page, DEALER_ORIGIN, "/login", RYG);
    await page.goto(`${DEALER_ORIGIN}/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "ตั้งค่าใบเสนอราคา" }).first().click();

    await expect.poll(async () => page.evaluate(() => document.body.innerText),
      { timeout: 20_000, message: "ตัวแทนต้องเห็น VAT ที่ HQ ตั้งใหม่" }).toContain(String(newVat));

    assertNoErrors(errs, "VAT ถึงตัวแทน");
  } finally {
    await sb.from("hq_policy").update({ vat: origVat }).eq("id", 1);
  }
});

test("[func·hq] HQ เปิดหน้างานขายได้ แต่ไม่มีปุ่มสร้าง/แก้/ลบ", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/quotations`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => (await page.evaluate(() => document.body.innerText)).length,
    { timeout: 20_000 }).toBeGreaterThan(100);

  // สิทธิ์ที่ DB ห้าม HQ เขียนงานขายอยู่แล้ว — หน้าจอต้องไม่หลอกให้กด
  for (const label of ["สร้างใบเสนอราคา", "เพิ่มใบเสนอราคา", "ลบใบเสนอราคา"]) {
    expect(await page.getByRole("button", { name: label }).count(),
      `หน้า HQ ต้องไม่มีปุ่ม "${label}"`).toBe(0);
  }

  assertNoErrors(errs, "หน้าใบเสนอราคา HQ");
});
