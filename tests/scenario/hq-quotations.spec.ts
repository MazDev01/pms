import { test, expect } from "@playwright/test";
import { open, assertHealthyPage } from "./helpers";

// ─── HQ · ใบเสนอราคาทั้งเครือ ─────────────────────────────────────────────────
// ล็อกสเปก: HQ ดูอย่างเดียว · KPI 4 ตัว · กราฟครบตามที่ข้อมูลจริงรองรับ
// และล็อก "สิ่งที่ต้องไม่มี" เพราะข้อมูลไม่รองรับ/บอสสั่งลบ (กันใครเผลอเอากลับมา)

// กติกา (globals.css): ทุกหน้าใช้ KPI 4 ใบเท่ากัน — ห้ามเพิ่มเป็น 5+
// (.hq-kpi5/.hq-kpi7/.hq-kpi8 ถูกลบทิ้งแล้ว · ปฏิเสธ/หมดอายุ/มูลค่าเฉลี่ย ดูได้จากตาราง+ตัวกรองสถานะแทน)
test("[ux·hq] KPI 4 ตัว คำนวณสอดคล้องกัน (ไม่มี 'ลูกค้าเปิดอ่าน')", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  await assertHealthyPage(page, "ใบเสนอราคาทั้งเครือ");
  const tiles = page.locator(".hq-kpi4 > div");
  await expect(tiles).toHaveCount(4);
  for (const label of ["ใบเสนอราคาทั้งหมด", "มูลค่ารวม", "ตอบรับ", "อัตราปิดการขาย"]) {
    await expect(page.locator(".hq-kpi4").getByText(label, { exact: true })).toBeVisible();
  }
  // อัตราปิดการขาย = ตอบรับ ÷ ใบที่ส่งแล้ว → ต้องกำกับตัวหารไว้ให้ตรวจสอบได้
  await expect(page.locator(".hq-kpi4").getByText(/\d+\/\d+ ใบที่ส่งแล้ว/)).toBeVisible();
});

test("[ux·hq] มีกราฟครบตามที่ข้อมูลจริงรองรับ", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  for (const title of [
    "ลีด → ใบเสนอราคา รายตัวแทน",
    "มูลค่าใบเสนอราคา เทียบ ยอดขายจริง",
    "ออกใบเสนอราคาเยอะ แต่ปิดได้น้อย",
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

// กราฟ "ออกใบเยอะ แต่ปิดได้น้อย" — กันอ่านผิดว่า "ใบที่ยังรอลูกค้าตอบ" = "ปิดไม่ได้"
// ตัวเลขต้องตรงกับคอลัมน์ "อัตราปิดการขาย" ในตารางอันดับ (นิยามเดียวกัน: ตอบรับ ÷ ใบที่ส่งแล้ว)
test("[ux·hq] กราฟออกใบเยอะแต่ปิดน้อย แยก 'ยังรอตอบ' ออกจาก 'ปิดไม่ได้'", async ({ page }) => {
  await open(page, "hq", "/hq/quotations");
  const card = page.locator(".card").filter({ hasText: "ออกใบเสนอราคาเยอะ แต่ปิดได้น้อย" }).first();
  await expect(card).toBeVisible();
  // ต้องมีคำอธิบายสีครบ 4 กลุ่ม — "ยังรอลูกค้าตอบ" ต้องเป็นกลุ่มแยก ไม่ถูกเหมารวมเป็นล้มเหลว
  for (const l of ["ปิดได้", "ปิดไม่ได้", "หมดอายุ", "ยังรอลูกค้าตอบ"]) {
    await expect(card.getByText(l, { exact: true }), `ต้องแยกกลุ่ม "${l}"`).toBeVisible();
  }
  // แต่ละแถวบอกตัวหารชัด (ปิดได้ X / Y ใบ) — ตรวจสอบย้อนได้ ไม่ใช่ % ลอย ๆ
  await expect(card.getByText(/ปิดได้ \d+ \/ \d+ ใบ/).first()).toBeVisible();

  // ตัวแทนแถวแรก (ออกใบเยอะสุด) ต้องมี % ตรงกับตารางอันดับของหน้าเดียวกัน
  const first = (await card.getByText(/ปิดได้ \d+ \/ \d+ ใบ\d+%/).first().innerText()).replace(/\s/g, "");
  const m = /ปิดได้(\d+)\/(\d+)ใบ(\d+)%/.exec(first);
  expect(m, `อ่านแถวแรกไม่ได้: ${first}`).not.toBeNull();
  const [, won, sent, pct] = m!.map(Number);
  expect(Math.round((won / sent) * 100), "% ต้องคำนวณจากตัวเลขที่แสดงจริง").toBe(pct);
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
