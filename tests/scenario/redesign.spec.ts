import { test, expect } from "@playwright/test";
import { open, assertHealthyPage } from "./helpers";

// รายละเอียดใบเสนอราคา = โมดัล Split 70/30 (เอกสาร BOQ ซ้าย · สรุป/ลูกค้า/ลีด ขวา)
test("[ui·dealer] Drawer ใบเสนอราคา (BOQ + สรุป + สถานะ) ไม่ล้นแนวนอน", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await assertHealthyPage(page, "ใบเสนอราคา");
  await page.locator("tbody tr").first().click();
  // เอกสาร BOQ (ซ้าย) + สรุป (ขวา) + เปลี่ยนสถานะ/ลูกค้า/ลูกค้าเป้าหมาย
  await expect(page.getByText("รายการสินค้า (BOQ)")).toBeVisible();
  await expect(page.getByText("รายละเอียดเอกสาร")).toBeVisible();
  await expect(page.getByText("สรุปใบเสนอราคา")).toBeVisible();
  await expect(page.getByRole("button", { name: /พิมพ์ \/ ดาวน์โหลด PDF/ })).toBeVisible();
  // โมดัลใหญ่ต้องไม่ทำให้หน้าเลื่อนแนวนอน
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "โมดัลใบเสนอราคาไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});

// รายละเอียดลูกค้า = โมดัลกลางจอ แบบแท็บเดียวกับลูกค้าเป้าหมาย (ภาพรวม/ดีล/ใบเสนอราคา/ไทม์ไลน์)
test("[ui·dealer] โมดัลลูกค้าแบบแท็บ (ภาพรวม/ดีล/ไทม์ไลน์) ไม่ล้นแนวนอน", async ({ page }) => {
  await open(page, "dealer", "/customers");
  await assertHealthyPage(page, "ลูกค้า");
  await page.locator(".cust-card").first().getByRole("button", { name: "รายละเอียด" }).click();
  // แท็บ ภาพรวม (default) → สรุปข้อมูลลูกค้า
  await expect(page.getByText("สรุปข้อมูลลูกค้า")).toBeVisible();
  // สลับแท็บ ดีล/โครงการ
  await page.getByRole("button", { name: "ดีล/โครงการ" }).click();
  await expect(page.getByText("ดีล / โครงการ", { exact: false }).first()).toBeVisible();
  // สลับแท็บ ไทม์ไลน์
  await page.getByRole("button", { name: "ไทม์ไลน์", exact: true }).click();
  await expect(page.getByText("ไทม์ไลน์กิจกรรม")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "โมดัลลูกค้าไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});

// ยอดเงินตรงกันทั้งระบบ (ก่อน VAT = ยอดที่บันทึก · รวม VAT = เอกสารพิมพ์) กัน VAT หาย/กำกวม
test("[ux·dealer] wizard แยก 'ก่อน VAT' (ยอดที่บันทึก) กับ 'รวม VAT' ชัดเจน", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await page.getByRole("button", { name: "เพิ่มใบเสนอราคา" }).click();
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
test("[ux·dealer] ใบเสนอราคาที่สร้างใหม่โชว์ยอดเต็ม ไม่ย่อ M/K", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await page.getByRole("button", { name: "เพิ่มใบเสนอราคา" }).click();
  await page.getByPlaceholder(/ค้นหาลูกค้า/).click();
  await page.waitForTimeout(200);
  await page.locator("div[style*='position: absolute'] button").first().click();
  await page.getByRole("button", { name: /สร้างดีลใหม่/ }).click();
  // ฟอร์มหน้าเดียว — select หลายตัวอยู่พร้อมกัน จึงเจาะจงด้วยข้อความ option
  await page.locator("select").filter({ hasText: "เลือกประเภท" }).selectOption({ index: 1 }); // ประเภทโครงการ (ดีล)
  // เพิ่มรายการ BOQ จากแคตตาล็อก แล้วตั้งจำนวนในแถว (ช่องพื้นที่ถูกตัดออก — คุมยอดจากจำนวน BOQ → ยอดหลักล้าน)
  await page.getByRole("button", { name: /เลือกจากแคตตาล็อก/ }).click();
  await page.getByRole("button", { name: /฿[\d,]+\/ตร\.ม\./ }).first().click();
  await page.locator("table tbody input[type='number']").first().fill("1000"); // จำนวน (qty) ของรายการ BOQ แรก
  const qid = (await page.locator("text=/Q-2026-\\d{4}/").last().innerText()).match(/Q-2026-\d{4}/)?.[0] ?? "";
  await page.getByRole("button", { name: /บันทึกร่าง/ }).click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder(/ค้นหา/).first().fill(qid);
  await page.waitForTimeout(400);
  const joined = (await page.locator("tbody tr").first().locator("td").allInnerTexts()).join(" | ");
  expect(/฿[\d,]{5,}/.test(joined), "ต้องเป็นเลขเต็มมี comma").toBeTruthy();
  expect(/฿[\d.]+[MK]\b/.test(joined), "ต้องไม่ย่อ M/K").toBeFalsy();
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

// wizard: คำ "ดีล" (ไม่ใช่ Deal) · วันที่ default = วันนี้ระบบ · ปุ่มบันทึก disabled บอกเหตุผล
test("[ux·dealer] wizard คำดีล/วันที่วันนี้/เหตุผลบันทึกไม่ได้", async ({ page }) => {
  await open(page, "dealer", "/quotations");
  await page.getByRole("button", { name: "เพิ่มใบเสนอราคา" }).click();
  await page.getByPlaceholder(/ค้นหาลูกค้า/).click();
  await page.waitForTimeout(200);
  await page.locator("div[style*='position: absolute'] button").first().click();
  // #3 ใช้คำ "สร้างดีลใหม่" ไม่ใช่ "สร้าง Deal ใหม่"
  await expect(page.getByRole("button", { name: "สร้างดีลใหม่" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /สร้าง Deal ใหม่/ })).toHaveCount(0);
  // ฟอร์มหน้าเดียว — วันที่ออก/ปุ่มบันทึก/เหตุผล อยู่บนหน้าเดียว ไม่ต้องกดถัดไป
  // #4 วันที่ออก default = 2026-06-30 (วันนี้ของระบบ)
  await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-06-30");
  // #5 ปุ่มบันทึก disabled + มีเหตุผลข้างปุ่ม (ยังไม่เลือกดีล)
  await expect(page.getByText(/ยังบันทึกไม่ได้:/)).toBeVisible();
  await expect(page.getByRole("button", { name: /บันทึกร่าง/ })).toBeDisabled();
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

// รายละเอียดลูกค้าเป้าหมาย (ต้นแบบ) ยังคง Split 70/30 พร้อม Sales Pipeline
test("[ui·dealer] Drawer ลูกค้าเป้าหมายมี Sales Pipeline + สรุปโอกาสการขาย", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await assertHealthyPage(page, "ลูกค้าเป้าหมาย");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง
  await page.waitForTimeout(300);
  // คลิกเซลล์ชื่อบริษัท (เซลล์แรก) — เซลล์กลางมี dropdown สถานะ
  await page.locator("tbody tr").first().locator("td").first().click();
  await expect(page.getByText("สรุปโอกาสการขาย")).toBeVisible();
  await expect(page.getByText("Sales Pipeline")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "โมดัลลีดไม่ควรมี horizontal scroll").toBeLessThanOrEqual(3);
});
