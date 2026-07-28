import { test, expect } from "@playwright/test";
import { open, assertHealthyPage, openLeadQuotationForm } from "./helpers";
import { SUPABASE_MODE } from "./supabaseEnv";

// "วันนี้ของระบบ" (APP_NOW) เดินตามแหล่งข้อมูล: supabase = วันจริง · local = ตรึง 30 มิ.ย. 2569
// เทสต์ประทับวันใบใหม่จึงต้องคำนวณวันคาดหวังแบบเดียวกัน (ไม่ hardcode "30 มิ.ย.")
const TH_MO_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function appNowThaiShort(): string {
  const d = SUPABASE_MODE ? new Date() : new Date(2026, 5, 30); // ตรงกับ APP_NOW ใน FilterContext
  return `${d.getDate()} ${TH_MO_ABBR[d.getMonth()]}`;           // เช่น "30 มิ.ย." (ตรงกับ fmtISOToThai แบบไม่รวมปี)
}

// รายละเอียดใบเสนอราคา = drawer คอลัมน์เดียว (หัวแผง = สรุป/สถานะ/ยอด · เนื้อ = เอกสาร + BOQ + เปลี่ยนสถานะ)
test("[ui·dealer] Drawer ใบเสนอราคา (BOQ + สรุป + สถานะ) ไม่ล้นแนวนอน", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await assertHealthyPage(page, "ใบเสนอราคา");
  await page.locator("tbody tr").first().click();
  // เอกสาร + BOQ + ยอดสรุป + เปลี่ยนสถานะ
  await expect(page.getByText("รายการสินค้า (BOQ)")).toBeVisible();
  await expect(page.getByText("รายละเอียดเอกสาร")).toBeVisible();
  // สรุปยอด = ยอดรวมสุทธิท้าย BOQ (หัวข้อ "สรุปใบเสนอราคา" ถูกยุบไปเป็นป้ายบนหัวแผงแล้ว)
  // (ไม่เช็ค "เปลี่ยนสถานะ" — โผล่เฉพาะใบที่ลูกค้ายังไม่ตอบ ส่วนแถวแรกเป็นใบที่ตอบรับแล้ว)
  await expect(page.getByText("ยอดรวมสุทธิ (รวม VAT)")).toBeVisible();
  await expect(page.getByRole("button", { name: "พิมพ์ PDF" })).toBeVisible();
  // โมดัลใหญ่ต้องไม่ทำให้หน้าเลื่อนแนวนอน
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "โมดัลใบเสนอราคาไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});

// รายละเอียดลูกค้า = โมดัลกลางจอ 2 แท็บ (ข้อมูลลูกค้า · เพิ่มงานขายใหม่)
// ตัวแทนสร้างลูกค้าเองไม่ได้ (ลูกค้าเกิดจากปิดการขาย) → แท็บที่สองคือการเปิดดีลใหม่ให้ลูกค้าเดิม
test("[ui·dealer] โมดัลลูกค้าแบบแท็บ (ข้อมูลลูกค้า/เพิ่มงานขายใหม่) ไม่ล้นแนวนอน", async ({ page }) => {
  await open(page, "dealer", "/customers");
  await assertHealthyPage(page, "ลูกค้า");
  await page.getByRole("button", { name: "ดูรายละเอียด" }).first().click();
  // แท็บ ข้อมูลลูกค้า (default) → โปรไฟล์ลูกค้า + ยอดขายรวม
  // (คำเดียวกันโผล่ในตารางเบื้องหลังด้วย จึงต้อง .first())
  await expect(page.getByText("รหัสลูกค้า").first()).toBeVisible();
  await expect(page.getByText("ยอดขายรวม").first()).toBeVisible();
  // สลับแท็บ เพิ่มงานขายใหม่ (ดีลของลูกค้ารายนี้) แล้วกลับได้
  await page.getByRole("button", { name: "เพิ่มงานขายใหม่" }).first().click();
  await expect(page.getByRole("button", { name: "ข้อมูลลูกค้า" }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "โมดัลลูกค้าไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});

// ยอดเงินตรงกันทั้งระบบ (ก่อน VAT = ยอดที่บันทึก · รวม VAT = เอกสารพิมพ์) กัน VAT หาย/กำกวม
test("[ux·dealer] ฟอร์มใบเสนอราคาแยก 'ก่อน VAT' (ยอดที่บันทึก) กับ 'รวม VAT' ชัดเจน", async ({ page }) => {
  await openLeadQuotationForm(page);
  await expect(page.getByText("มูลค่างาน (ก่อน VAT)")).toBeVisible();
  await expect(page.getByText("= ยอดที่บันทึกในใบเสนอราคา")).toBeVisible();
  await expect(page.getByText("ยอดรวมสุทธิ (รวม VAT)")).toBeVisible();
  await expect(page.getByText(/Grand Total/), "เลิกใช้คำกำกวม Grand Total").toHaveCount(0);
});

test("[ux·dealer] โมดัลดูใบเสนอราคาแสดง VAT ครบ (ก่อน VAT + VAT% + รวม VAT)", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await page.locator("tbody tr").first().click();
  await expect(page.getByText("มูลค่างาน (ก่อน VAT)").first()).toBeVisible();
  await expect(page.getByText(/^VAT \d+%$/).first()).toBeVisible();
  await expect(page.getByText("ยอดรวมสุทธิ (รวม VAT)")).toBeVisible();
});

// ใบเสนอราคาที่สร้างใหม่ต้องเก็บ total เป็นเลขเต็ม (฿5,100,000) เหมือน seed ไม่ย่อ M/K
// (งานขายเก็บลง localStorage → สร้างที่หน้าลีดแล้วข้ามไปหน้าใบเสนอราคาได้ ข้อมูลไม่หาย)
test("[ux·dealer] ใบเสนอราคาที่สร้างใหม่โชว์ยอดเต็ม ไม่ย่อ M/K", async ({ page }) => {
  await openLeadQuotationForm(page);
  // ฟอร์มมีรายการ BOQ ตั้งต้นจากแม่แบบของลีดอยู่แล้ว → ยอดถูกคำนวณให้ กดสร้างได้เลย
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).last().click();
  await page.waitForTimeout(800);

  // ใบสร้างบนแอปตัวแทน (:3001) → localStorage อยู่ origin นั้น ต้องเปิด /quotations ของ :3001 (ไม่ใช่ baseURL :3002 = HQ)
  await page.goto("http://localhost:3001/quotations", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // ใบที่เพิ่งสร้าง = ร่าง → กรองสถานะร่างเพื่อเจาะให้ตรงใบใหม่
  const joined = (await page.locator("tbody tr").first().locator("td").allInnerTexts()).join(" | ");
  expect(/฿[\d,]{5,}/.test(joined), `ต้องเป็นเลขเต็มมี comma — ได้: ${joined}`).toBeTruthy();
  expect(/฿[\d.]+[MK]\b/.test(joined), `ต้องไม่ย่อ M/K — ได้: ${joined}`).toBeFalsy();
});

// ฟอร์มสร้างใบเสนอราคา inline ในหน้า Lead (รีสไตล์ให้เหมือน wizard) — VAT breakdown + section เหมือนกัน
test("[ui·dealer] ฟอร์มใบเสนอราคา inline ในหน้าลีดรีสไตล์แล้ว (VAT breakdown)", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง
  await page.waitForTimeout(300);
  await page.locator("tbody tr").first().locator("td").first().click(); // เปิดแผงรายละเอียด
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: true }).first().click(); // แท็บใบเสนอราคา
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).first().click(); // ปุ่มสร้างในแผง
  await expect(page.getByText("สร้างใบเสนอราคาใหม่")).toBeVisible();
  // แม่แบบ + BOQ รวมเป็นก้อนเดียว "รายการใบเสนอราคา" — เลือกแม่แบบจากแคตตาล็อกใน BOQ (ไม่มีช่องแม่แบบซ้ำ)
  await expect(page.getByText("รายการใบเสนอราคา")).toBeVisible();
  await expect(page.getByText("ชื่อโครงการ / เอกสาร")).toBeVisible();
  await expect(page.getByText("แม่แบบที่เสนอ"), "ช่องแม่แบบซ้ำถูกตัดออกแล้ว").toHaveCount(0);
  await expect(page.getByText("รายการสินค้า (BOQ)").first()).toBeVisible();
  // ยอดเงินโชว์แบบเดียวกับ wizard: ก่อน VAT (ยอดที่บันทึก) + รวม VAT
  await expect(page.getByText("มูลค่างาน (ก่อน VAT)")).toBeVisible();
  await expect(page.getByText("ยอดรวมสุทธิ (รวม VAT)")).toBeVisible();
  await expect(page.getByText("ยอดสุทธิ (คำนวณ)"), "ฟิลด์แบบเก่าถูกแทนแล้ว").toHaveCount(0);
});

// ใบที่สร้างใหม่ต้องลงวันที่ = "วันนี้" ของระบบ (APP_NOW) ไม่ใช่วันที่กรอกเอง
// (วันที่ออกไม่ใช่ช่องให้กรอกอีกแล้ว — ระบบประทับให้ตอนบันทึก · ช่องวันที่ในฟอร์ม = วันหมดอายุ)
test("[ux·dealer] ใบเสนอราคาที่สร้างใหม่ลงวันที่วันนี้ของระบบ", async ({ page }) => {
  await openLeadQuotationForm(page);
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).last().click();
  await page.waitForTimeout(800);

  // ใบสร้างบนแอปตัวแทน (:3001) → localStorage อยู่ origin นั้น ต้องเปิด /quotations ของ :3001 (ไม่ใช่ baseURL :3002 = HQ)
  await page.goto("http://localhost:3001/quotations", { waitUntil: "domcontentloaded" });
  // การสร้างใบเป็น async (ขอเลขที่ผ่าน repo + บันทึก) → รอแบบ poll ไม่ใช่ timeout ตายตัว (กันเทสต์วูบ)
  // ตารางเรียงใบใหม่สุดไว้บน → แถวแรกต้องลงวันที่ของ "วันนี้" ระบบ
  const expectedDate = appNowThaiShort();
  await expect.poll(
    async () => (await page.locator("tbody tr").first().locator("td").allInnerTexts()).join(" | "),
    { message: `ใบที่สร้างใหม่ต้องลงวันที่ ${expectedDate} (วันนี้ของระบบ)`, timeout: 10_000 },
  ).toContain(expectedDate);
});

// Smart filter: ลีดขาดติดต่อ >7/14/30 วัน — จำนวนอยู่บนการ์ด KPI "เกิน 7 วัน" (ไม่ซ้ำ)
// ตัวกรองเกณฑ์วันเป็น dropdown บนแถบเครื่องมือ (เดิมเป็นชิป >7/>14/>30 — เปลี่ยนแล้ว)
test("[ux·dealer] Smart filter ค้างติดต่อ (>7/14/30 วัน) + กรองได้", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await assertHealthyPage(page, "ลูกค้าเป้าหมาย");

  // การ์ด KPI บอกจำนวนลีดที่ค้างเกิน 7 วัน
  const kpi = page.getByRole("button", { name: /^เกิน 7 วัน/ });
  await expect(kpi).toBeVisible();
  const overdue = parseInt((await kpi.innerText()).split("\n")[1], 10);

  // ตัวกรองค้างติดต่อ = dropdown เกณฑ์วัน (aria-label มาจาก caption ของ FilterSelect)
  const idle = page.getByLabel("ค้างติดต่อทุกช่วง");
  await expect(idle).toBeVisible();
  for (const d of [7, 14, 30]) {
    await expect(idle.getByRole("option", { name: `ค้างติดต่อ >${d} วัน`, exact: true }), `ต้องมีเกณฑ์ >${d} วัน`).toHaveCount(1);
  }

  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตารางเพื่อนับแถว
  const rows = page.locator("tbody tr");
  const before = await rows.count();

  // กรอง >7 วัน → จำนวนแถวต้องตรงกับตัวเลขบนการ์ด KPI (เช็คว่าการ์ดกับตัวกรองนับด้วยเกณฑ์เดียวกันจริง)
  // เทียบตรง ๆ ได้เพราะจำนวนน้อยกว่าขนาดหน้า (10) — ถ้าข้อมูลโตเกินนั้นต้องคิดเรื่องแบ่งหน้าด้วย
  await idle.selectOption("7");
  expect(overdue, "ลีดค้างเกิน 7 วันต้องไม่เกิน 1 หน้า มิฉะนั้นเทียบกับแถวตรง ๆ ไม่ได้").toBeLessThanOrEqual(10);
  await expect.poll(() => rows.count(), { timeout: 5_000 }).toBe(overdue);
  expect(overdue, "กรองแล้วต้องเหลือน้อยกว่าทั้งหมด").toBeLessThanOrEqual(before);
});

// รายละเอียดลูกค้าเป้าหมาย = แผงกลางจอ 4 แท็บ ครอบเส้นทางการขายทั้งเส้น (งาน → ใบเสนอราคา → ไทม์ไลน์)
// เปิดด้วยปุ่ม "ดูรายละเอียด" ในแถว (คลิกเซลล์เปล่าไม่เปิดแล้ว — เซลล์มี dropdown สถานะ/ปุ่มลัดของตัวเอง)
test("[ui·dealer] แผงลูกค้าเป้าหมายมีครบ 4 แท็บ ไม่ล้นแนวนอน", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await assertHealthyPage(page, "ลูกค้าเป้าหมาย");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง
  await page.getByRole("button", { name: "ดูรายละเอียด" }).first().click();
  for (const tab of ["ภาพรวม", "งาน", "ใบเสนอราคา", "ไทม์ไลน์"]) {
    await expect(page.getByRole("button", { name: tab, exact: true }).first(), `ต้องมีแท็บ "${tab}"`).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "แผงลีดไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});
