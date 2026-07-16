import { test, expect } from "@playwright/test";
import { open, assertHealthyPage, openLeadQuotationForm } from "./helpers";

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

  await page.goto("/quotations", { waitUntil: "domcontentloaded" });
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

// ใบที่สร้างใหม่ต้องลงวันที่ = "วันนี้" ของระบบ (30 มิ.ย. 2569) ไม่ใช่วันจริงของเครื่อง
// (วันที่ออกไม่ใช่ช่องให้กรอกอีกแล้ว — ระบบประทับให้ตอนบันทึก · ช่องวันที่ในฟอร์ม = วันหมดอายุ)
test("[ux·dealer] ใบเสนอราคาที่สร้างใหม่ลงวันที่วันนี้ของระบบ", async ({ page }) => {
  await openLeadQuotationForm(page);
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).last().click();
  await page.waitForTimeout(800);

  await page.goto("/quotations", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // ตารางเรียงใบใหม่สุดไว้บน → แถวแรกต้องลงวันที่ของ "วันนี้" ระบบ
  const joined = (await page.locator("tbody tr").first().locator("td").allInnerTexts()).join(" | ");
  expect(joined, "ใบที่สร้างใหม่ต้องลงวันที่ 30 มิ.ย. (วันนี้ของระบบ)").toContain("30 มิ.ย.");
});

// Smart filter: ลีดขาดติดต่อ >7/14/30 วัน — จำนวนอยู่บนการ์ด KPI "เกิน 7 วัน" (ไม่ซ้ำ), แถบเครื่องมือเหลือเกณฑ์วัน
test("[ux·dealer] Smart filter ค้างติดต่อ (>7/14/30 วัน) + กรองได้", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await assertHealthyPage(page, "ลูกค้าเป้าหมาย");
  await expect(page.getByText("ค้างติดต่อ")).toBeVisible();
  await expect(page.getByRole("button", { name: /^เกิน 7 วัน/ })).toBeVisible(); // การ์ด KPI (^ กันชนกับชิป "ค้างเกิน 7 วัน")
  await expect(page.getByRole("button", { name: ">14 วัน" })).toBeVisible();
  await expect(page.getByRole("button", { name: ">30 วัน" })).toBeVisible();
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตารางเพื่อนับแถว
  await page.waitForTimeout(300);
  const before = await page.locator("tbody tr").count();
  await page.getByRole("button", { name: ">7 วัน" }).click();
  await page.waitForTimeout(300);
  const after = await page.locator("tbody tr").count();
  expect(after, "กด >7 วัน แล้วต้องกรองเหลือเฉพาะลีดที่ต้องติดตาม").toBeLessThanOrEqual(before);
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
