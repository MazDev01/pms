import { test, expect } from "@playwright/test";
import { open, assertHealthyPage } from "./helpers";

// ─── HQ · ใบเสนอราคาทั้งเครือ ─────────────────────────────────────────────────
// ล็อกสเปก: HQ ดูอย่างเดียว · KPI 7 ตัว · กราฟครบตามที่ข้อมูลจริงรองรับ
// และล็อก "สิ่งที่ต้องไม่มี" เพราะข้อมูลไม่รองรับ/บอสสั่งลบ (กันใครเผลอเอากลับมา)

test("[ux·hq] KPI 7 ตัว คำนวณสอดคล้องกัน (ไม่มี 'ลูกค้าเปิดอ่าน')", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ");
  const tiles = page.locator(".hq-kpi7 > div");
  await expect(tiles).toHaveCount(7);
  for (const label of ["ใบเสนอราคาทั้งหมด", "มูลค่ารวม", "ตอบรับ", "ปฏิเสธ", "หมดอายุ", "อัตราปิดการขาย", "มูลค่าเฉลี่ยต่อใบ"]) {
    await expect(page.locator(".hq-kpi7").getByText(label, { exact: true })).toBeVisible();
  }
  // อัตราปิดการขาย = ตอบรับ ÷ ใบที่ส่งแล้ว → ต้องกำกับตัวหารไว้ให้ตรวจสอบได้
  await expect(page.locator(".hq-kpi7").getByText(/\d+\/\d+ ใบที่ส่งแล้ว/)).toBeVisible();
});

test("[ux·hq] มีกราฟครบตามที่ข้อมูลจริงรองรับ", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  for (const title of [
    "ลีด → ใบเสนอราคา รายตัวแทน",
    "มูลค่าใบเสนอราคา เทียบ ยอดขายจริง",
    "ประเภทอาคาร",
    "เทียบรายภูมิภาค",
    "เหตุผลที่เสียโอกาสการขาย",
    "อายุใบเสนอราคาที่ค้างอยู่",
    "แนวโน้มใบเสนอราคารายเดือน",
    "อันดับตัวแทนจำหน่าย",
  ]) {
    await expect(page.getByText(title, { exact: true }).first(), `ต้องมีกราฟ "${title}"`).toBeVisible();
  }
});

// ข้อมูลไม่รองรับ / บอสสั่งลบ — ห้ามกลับมา (ถ้าจะเอากลับต้องมีข้อมูลจริงรองรับก่อน)
test("[ux·hq] ไม่มีอัตราการเปิดอ่าน · ส่วนลด · การใช้แม่แบบ", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ");
  const main = page.locator(".erp");
  await expect(main.getByText(/เปิดอ่าน|Open Rate/)).toHaveCount(0);
  await expect(main.getByText(/ส่วนลด/)).toHaveCount(0);
  await expect(main.getByText(/การใช้แม่แบบ|Template Usage/)).toHaveCount(0);
});

// เหตุผลที่เสียโอกาส เก็บที่ "ลีด" ไม่ใช่ใบเสนอราคา → ต้องกำกับที่มาบนหน้าจอ ห้ามปล่อยให้เข้าใจผิด
test("[ux·hq] กราฟเหตุผลที่เสียโอกาส กำกับว่าที่มาคือลีด", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ"); // รอหน้าพร้อมก่อน — กันอ่านตอน React ยังไม่ hydrate
  await expect(page.getByText(/นับจากลีดที่ปิดไม่สำเร็จ/)).toBeVisible();
  await expect(page.getByText(/ระบบไม่ได้เก็บเหตุผลรายใบเสนอราคา/)).toBeVisible();
});

// จังหวัด = ของ "ตัวแทนที่ออกใบ" ไม่ใช่ของลูกค้า → ป้ายต้องเขียนชัด
test("[ux·hq] คอลัมน์/ตัวกรองจังหวัด กำกับว่าเป็นจังหวัดตัวแทน", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await expect(page.getByRole("columnheader", { name: "จังหวัดตัวแทน" })).toBeVisible();
  await expect(page.getByLabel("จังหวัดตัวแทน")).toBeVisible();
});

// ช่วงมูลค่าต้องแบ่งไม่ทับกันและไม่ตกหล่น — ผลรวมทุกช่วง = ทั้งหมด
test("[ux·hq] ตัวกรองช่วงมูลค่าแบ่งครบ ไม่นับซ้ำ", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ"); // รอหน้าพร้อมก่อน — กันอ่านตอน React ยังไม่ hydrate
  // จำนวนใบอ่านจากป้าย "N ใบ" ข้างช่องค้นหา (อัปเดตตามตัวกรองทันที)
  const shown = page.locator(".hq-sticky-filter").getByText(/^\d+ ใบ$/).first();
  const total = async () => parseInt((await shown.innerText()).replace(" ใบ", ""), 10);

  await expect(shown).toBeVisible();
  const all = await total();
  expect(all, "ต้องมีใบเสนอราคาให้ตรวจ").toBeGreaterThan(0);

  let sum = 0;
  for (const band of ["lt1m", "1m-3m", "3m-5m", "5m-10m", "gte10m"]) {
    // กลับไป "ทุกช่วงมูลค่า" ก่อนทุกครั้ง → จำนวนเด้งกลับเป็น all แล้วค่อยเลือกช่วงถัดไป
    // ทำให้รอได้แน่ ๆ ว่า "ตัวกรองมีผลแล้ว" = ตัวเลขนิ่งและไม่เท่ากับ all ค้างจากรอบก่อน
    await page.getByLabel("ช่วงมูลค่า").selectOption("all");
    await expect.poll(() => total(), { timeout: 5_000 }).toBe(all);
    await page.getByLabel("ช่วงมูลค่า").selectOption(band);
    // ไม่มีช่วงไหนกินทั้งหมด → ตัวเลขต้องขยับออกจาก all เสมอ ใช้เป็นสัญญาณว่า "กรองแล้วจริง"
    await expect.poll(() => total(), { timeout: 5_000 }).not.toBe(all);
    sum += await total();
  }
  expect(sum, "ผลรวมทุกช่วงมูลค่าต้องเท่ากับใบทั้งหมด (ไม่ทับกัน/ไม่ตกหล่น)").toBe(all);
});

// HQ ดูอย่างเดียว — ไม่มีสร้าง/แก้ไข/ลบ/อนุมัติ
test("[ux·hq] ไม่มีปุ่มสร้าง/แก้ไข/ลบ/อนุมัติ มีแต่ดู", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ");
  const main = page.locator(".erp");
  for (const name of [/เพิ่มใบเสนอราคา|สร้างใบเสนอราคา/, /^แก้ไข$/, /^ลบ$/, /^อนุมัติ$/]) {
    await expect(main.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(main.getByRole("button", { name: "ดู" }).first()).toBeVisible();
});

// ลิ้นชักรายละเอียด = อ่านอย่างเดียว
// หมายเหตุ: ต้องกดปุ่ม "ดู" ในตารางใบเสนอราคาเท่านั้น — ปุ่มในตารางอันดับตัวแทน
// ชื่อ "ดูรายละเอียดตัวแทน" ซึ่ง match คำว่า "ดู" ได้เหมือนกัน แต่พาไปหน้าตัวแทน
test("[ux·hq] ลิ้นชักดูใบเสนอราคา อ่านอย่างเดียว", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await page.getByRole("button", { name: "ดู", exact: true }).first().click();
  const drawer = page.getByRole("dialog", { name: "รายละเอียดใบเสนอราคา" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("ข้อมูลใบเสนอราคา")).toBeVisible();
  await expect(drawer.getByText(/ส่วนลด|ประวัติการเปิดอ่าน/)).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: /แก้ไข|ลบ|อนุมัติ/ })).toHaveCount(0);
});
