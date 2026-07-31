import { test, expect } from "@playwright/test";
import { open, openLeadQuotationForm } from "./helpers";

// ─── Persona: UX Expert ───────────────────────────────────────────────────────
// "flow ราบรื่นไหม · เตือนตอนควรเตือนไหม · กันพลาดไหม · แต่ละ role เห็นสิ่งที่ต่างกันไหม"

// แถบหัวข้อของหน้าตั้งค่า HQ — ต้องเจาะจงขอบเขตนี้เสมอ
// ไม่งั้นชื่อหัวข้ออย่าง "การแจ้งเตือน" จะไปชนกับกระดิ่งบนแถบบน
const HQ_SETTINGS_NAV = ".tab-bar";

// เมนู HQ ต้องไปได้ทุกลิงก์ (ไม่มี dead link)
test("[ux·hq] เมนูข้างไปได้ทุกหน้า", async ({ page }) => {
  await open(page, "hq", "/hq/dashboard");
  const links = ["ตัวแทน", "ลูกค้าทั้งเครือ", "ภาพรวมยอดขาย", "ใบเสนอราคาทั้งเครือ", "แคตตาล็อกแม่แบบ", "บันทึกการใช้งาน", "ตั้งค่า"];
  for (const label of links) {
    await page.getByRole("link", { name: label, exact: false }).first().click();
    await expect(page.locator(".topbar-title").first()).toBeVisible(); // หัวข้อหน้าอยู่บน Topbar (ตัด h2 ซ้ำในหน้าออกแล้ว)
    await expect(page).not.toHaveURL(/\/hq\/dashboard$/); // ต้องออกจากแดชบอร์ดจริง
  }
});

// กันพลาด: แก้ค่าในตั้งค่าแล้วสลับหัวข้อ → ต้องเตือน "ยังไม่บันทึก"
// (ตั้งค่า HQ = เมนูซ้าย 6 หัวข้อ · หัวข้อ "ระบบ" กับ "กฎธุรกิจ" ถูกยุบไปแล้ว)
test("[ux·hq] เตือน unsaved เมื่อออกจากหัวข้อที่แก้ค้าง", async ({ page }) => {
  await open(page, "hq", "/hq/settings");
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /เป้าหมายยอดขาย/ }).click();
  const num = page.locator('input[type="number"]').first();
  await num.fill("999000000");
  let dialogMsg = "";
  page.once("dialog", (d) => { dialogMsg = d.message(); d.dismiss(); });
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /บริษัท/ }).click();
  await expect.poll(() => dialogMsg).toContain("ยังไม่บันทึก");
});

// บัญชีดีลเลอร์ = รวมโปรไฟล์ผู้ใช้ (รูป/ชื่อ/ตำแหน่ง) + ข้อมูลบริษัท + ข้อมูลบัญชี ไว้แท็บเดียว
test("[ux·dealer] บัญชีดีลเลอร์ รวมโปรไฟล์+บริษัท+ข้อมูลบัญชี ในที่เดียว", async ({ page }) => {
  await open(page, "dealer", "/settings"); // แท็บแรก = บัญชีดีลเลอร์
  await expect(page.getByText("ข้อมูลบริษัท (ออกในนามตัวแทน)")).toBeVisible();
  await expect(page.getByText("ข้อมูลบัญชี", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "จัดการรหัสผ่าน" })).toBeVisible();
  // อีเมลเข้าสู่ระบบ = อ่านอย่างเดียว (ตัวแทนแก้ไม่ได้)
  await expect(page.getByText("อีเมลเข้าสู่ระบบ").first()).toBeVisible();
});

// ป้ายเจ้าของ+มงกุฎ: อยู่ที่ก้น sidebar ที่เดียว (ไม่ซ้ำใน dropdown) · label ต่างกันตามสิทธิ์
test("[ux·hq] ก้น sidebar แสดงป้ายเจ้าของแพลตฟอร์ม (ที่เดียว)", async ({ page }) => {
  await open(page, "hq", "/hq/dashboard");
  await expect(page.locator(".sidebar-footer").getByText("เจ้าของแพลตฟอร์ม")).toBeVisible();
  // ต้องมีที่เดียว (ไม่ซ้ำใน dropdown บนขวา)
  await expect(page.getByText("เจ้าของแพลตฟอร์ม")).toHaveCount(1);
});
test("[ux·dealer] ก้น sidebar แสดงป้ายเจ้าของบัญชีตัวแทน ไม่ใช่เจ้าของแพลตฟอร์ม", async ({ page }) => {
  await open(page, "dealer", "/dashboard");
  await expect(page.locator(".sidebar-footer").getByText("เจ้าของบัญชีตัวแทน")).toBeVisible();
  await expect(page.getByText("เจ้าของแพลตฟอร์ม")).toHaveCount(0);
});

// HQ ล็อกเลขที่ใบเสนอราคา: ฝั่งตัวแทนดูได้ แก้ไม่ได้ (ไม่มี input พิมพ์ prefix)
test("[ux·dealer] ตัวแทนตั้งเลขที่ใบเสนอราคาเองได้ · ล็อกเฉพาะ VAT", async ({ page }) => {
  await open(page, "dealer", "/settings");
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: false }).first().click();
  // เลขที่ = ตัวแทนคุมเอง → มีช่องพิมพ์คำนำหน้า (prefix) แบบแก้ได้
  await expect(page.locator('input[value^="Q-"]')).toHaveCount(1);
  // ล็อกแค่อันจำเป็น — VAT ยังกำหนดโดยสำนักงานใหญ่ (กล่องอ่านอย่างเดียว + ป้าย HQ)
  await expect(page.getByText("ภาษีมูลค่าเพิ่ม %")).toBeVisible();
});

// ฟอร์มเพิ่มลูกค้าเป้าหมาย: เลือกขั้นได้เฉพาะก่อน "เสนอราคา" (ขั้นเสนอราคาต้องมีใบก่อน)
test("[ux·dealer] ฟอร์มเพิ่มลีดไม่มีขั้น 'เสนอราคา'", async ({ page }) => {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).click();
  await expect(page.getByText("กรอกข้อมูลลูกค้าเป้าหมาย")).toBeVisible();
  // ต้องเจาะที่ช่อง "ขั้นตอน" ของฟอร์มเท่านั้น — dropdown กรองสถานะบนแถบเครื่องมือ (หลังโมดัล)
  // มีครบทุกขั้นรวม "เสนอราคา" ตามปกติ ถ้าหาทั้งหน้าจะไปจับตัวนั้นแล้วฟ้องผิด
  const stage = page.getByLabel("ขั้นตอน");
  await expect(stage.getByRole("option", { name: "เสนอราคา", exact: true })).toHaveCount(0);
  await expect(stage.getByRole("option", { name: "ติดต่อแล้ว", exact: true })).toHaveCount(1);
});

// ใบเสนอราคา = ฟอร์มหน้าเดียว (ไม่มี stepper) · ทุก section แสดงพร้อมกัน · แม่แบบรวมกับ BOQ ไม่ซ้ำ
// ยอดเงินสรุปต้องแสดง "ที่เดียว" · หัวข้อ "รายการสินค้า (BOQ)" ต้องมีที่เดียว
test("[ux·dealer] ฟอร์มใบเสนอราคาหน้าเดียว + ยอด/หัวข้อ BOQ ไม่ซ้ำ", async ({ page }) => {
  await openLeadQuotationForm(page);
  // ทุก section แสดงพร้อมกันบนหน้าเดียว (ไม่มี stepper ให้กด · ไม่มีขั้น "เลือกแม่แบบ" แยก)
  await expect(page.getByText("ชื่อโครงการ / เอกสาร")).toBeVisible();
  await expect(page.getByText("รายการใบเสนอราคา")).toBeVisible();
  await expect(page.getByText("เลือกแม่แบบ", { exact: true })).toHaveCount(0);
  // ช่องเลือกแม่แบบ/หมวดอาคารซ้ำถูกตัดออก — แม่แบบมาจากรายการ BOQ ที่เดียว
  await expect(page.getByText(/หมวดอาคาร/)).toHaveCount(0);
  await expect(page.getByText("แม่แบบที่เสนอ")).toHaveCount(0);
  // หัวข้อ "รายการสินค้า (BOQ)" ต้องมีที่เดียว (LineItemsEditor ในตัว — ไม่ใส่ label ซ้ำ)
  await expect(page.getByText("รายการสินค้า (BOQ)")).toHaveCount(1);
  // ยอดสรุปโผล่ที่เดียว แยก ก่อน/รวม VAT
  await expect(page.getByText("มูลค่างาน (ก่อน VAT)")).toHaveCount(1);
  await expect(page.getByText("ยอดรวมสุทธิ (รวม VAT)")).toHaveCount(1);
});

// กันพลาด (ฝั่งตัวแทน): ตั้งค่า Dealer ใช้ปุ่มบันทึกกลางเดียวบนหัวเหมือน HQ + เตือน unsaved
test("[ux·dealer] ตั้งค่าใช้ปุ่มบันทึกกลาง + เตือน unsaved", async ({ page }) => {
  await open(page, "dealer", "/settings");
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: false }).first().click();
  // รอโหลดค่าตั้งต้นจาก DB เสร็จก่อน (baseline snapshot สำหรับเทียบ dirty) — โหมด supabase
  // ค่าตั้งต้นมาจาก fetch จริง ไม่ใช่ mock ในตัวแบบเดิม กรอกไวไปชนก่อน baseline พร้อมจะไม่ขึ้น dirty เลย
  await page.waitForTimeout(1500);
  const num = page.locator('input[type="number"]').first();
  await num.fill("9");
  // ตัวบ่งชี้ยังไม่บันทึก + ปุ่มบันทึกกลางบนหัวต้องกดได้
  await expect(page.getByText("ยังไม่บันทึก")).toBeVisible();
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toBeEnabled();
  let dialogMsg = "";
  page.once("dialog", (d) => { dialogMsg = d.message(); d.dismiss(); });
  await page.getByRole("button", { name: "ผู้รับผิดชอบ" }).click();
  await expect.poll(() => dialogMsg).toContain("ยังไม่บันทึก");
});

// ผู้ใช้ HQ: หน้า Users เฉพาะ HQ (ไม่มี dealer) + stat/matrix · action dropdown → รีเซ็ตรหัสผ่าน
test("[ux·hq] หน้าผู้ใช้ HQ เฉพาะ HQ + stat/matrix + รีเซ็ตรหัสผ่าน", async ({ page }) => {
  await open(page, "hq", "/hq/settings");
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /ผู้ใช้งานและสิทธิ์/ }).click();
  await expect(page.getByText("ผู้ใช้ทั้งหมด")).toBeVisible();
  await expect(page.getByText("Permission Matrix", { exact: false })).toBeVisible();
  // ต้องไม่มีผู้ใช้ของ Dealer (role เซลส์ตัวแทนหายไป)
  await expect(page.getByText("เซลส์ตัวแทน")).toHaveCount(0);
  // action dropdown → รีเซ็ตรหัสผ่าน → โมดัล "ส่งลิงก์อีเมล" (H4 · เดิมเป็นรหัสชั่วคราวปลอม)
  await page.getByRole("button", { name: "จัดการ" }).first().click();
  await page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
  await expect(page.getByRole("button", { name: "ส่งลิงก์รีเซ็ต" })).toBeVisible();
  await expect(page.getByText("รหัสผ่านชั่วคราว")).toHaveCount(0); // ไม่มีรหัสปลอมแบบเดิมแล้ว
});

// กันปุ่มซ้ำ: หัวข้อ "บริษัท" ของ HQ ฝังหน้าเต็ม → ต้องมีปุ่ม "บันทึก" เดียว (ปุ่มกลางบนหัว) ไม่ใช่สองปุ่ม
test("[ux·hq] หัวข้อบริษัทมีปุ่มบันทึกเดียว (ไม่ซ้ำ)", async ({ page }) => {
  await open(page, "hq", "/hq/settings");
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /บริษัท/ }).click();
  // ปุ่มบันทึกต้องเหลือปุ่มเดียวทั้งหน้า (ปุ่มกลางบนหัว) — หน้าที่ฝังไม่มีปุ่มของตัวเอง
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toHaveCount(1);
  // แก้ค่าแล้วปุ่มกลางต้องกดได้
  const first = page.locator('input.form-input').first();
  await first.fill("บริษัท ทดสอบ จำกัด");
  await expect(page.getByText("ยังไม่บันทึก")).toBeVisible();
  await expect(page.getByRole("button", { name: "บันทึก", exact: true })).toBeEnabled();
});

// Dealer Detail = read-only workspace + มีแท็บ ลูกค้า/กิจกรรม
test("[ux·hq] Dealer Detail อ่านอย่างเดียว + แท็บกิจกรรม", async ({ page }) => {
  await open(page, "hq", "/hq/dealers/CNX");
  await expect(page.getByText("โหมดดูอย่างเดียว")).toBeVisible();
  await page.getByRole("button", { name: /^กิจกรรม/ }).click();
  await expect(page.getByText("กิจกรรมล่าสุด")).toBeVisible();
});

// หัวข้อแจ้งเตือน HQ ต้องเป็นเรื่องที่ HQ คุม (กฎแจ้งเตือน + บันทึกการใช้งาน) ไม่ใช่งานขายของตัวแทน
test("[ux·hq] หัวข้อแจ้งเตือน HQ ใช้ event ของ HQ ไม่ใช่งานขายตัวแทน", async ({ page }) => {
  await open(page, "hq", "/hq/settings");
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /การแจ้งเตือน/ }).click();
  // เรื่องที่ HQ อยากเห็นจากบันทึกการใช้งาน
  await expect(page.getByText("จัดการตัวแทน")).toBeVisible();
  // "ส่วนลด" ถูกลบทั้งฟีเจอร์แล้ว → หัวข้อเหลือ "ราคากลาง" เฉย ๆ
  await expect(page.getByText("ราคากลาง", { exact: true })).toBeVisible();
  await expect(page.getByText(/ส่วนลด/), "ส่วนลดถูกลบทั้งฟีเจอร์แล้ว").toHaveCount(0);
  // ต้องไม่มี event งานขายของตัวแทนหลงมา
  await expect(page.getByText("มีลูกค้าเป้าหมายเข้ามาใหม่")).toHaveCount(0);
  await expect(page.getByText("ตัวแทนออกใบเสนอราคา")).toHaveCount(0);
});

// การแจ้งเตือนแยกตาม role: HQ = สุขภาพของเครือตามกฎแจ้งเตือนของ HQ + บันทึกการใช้งาน
// (บันทึกการใช้งานมีหน้าของตัวเองที่ /hq/audit แล้ว — กระดิ่งจึงเป็นกฎแจ้งเตือน 6 เรื่องเป็นหลัก
//  เหตุการณ์ audit จะโผล่ที่กระดิ่งด้วยเมื่อมีคนแก้จริง จึงไม่ยึดข้อความ audit เป็นหมุด)
test("[ux·hq] กระดิ่งแจ้งเตือนฝั่ง HQ เป็นเรื่องของเครือ ไม่ใช่งานขายของตัวแทน", async ({ page }) => {
  await open(page, "hq", "/hq/dashboard");
  await page.getByRole("button", { name: "การแจ้งเตือน" }).click();
  await expect(page.getByText("การแจ้งเตือน", { exact: true })).toBeVisible();
  // HQ ต้องไม่เห็น "งานที่ตัวแทนต้องทำ" (นั่นเป็นกระดิ่งของฝั่งตัวแทน)
  await expect(page.getByText("ลูกค้าเป้าหมายรอดำเนินการ")).toHaveCount(0);
  // เรื่องที่ขึ้นต้องมาจากกฎแจ้งเตือนของ HQ — จัดกลุ่มใต้หัวข้อ "ต้องดูด่วน" (สถานะเครือปัจจุบัน)
  await expect(page.getByText("ต้องดูด่วน").first()).toBeVisible();
});

// การแจ้งเตือนแยกตาม role: Dealer = งานขาย (ลูกค้าเป้าหมายรอดำเนินการ) ไม่ใช่ audit
test("[ux·dealer] กระดิ่งแจ้งเตือนฝั่งตัวแทนเป็นงานขาย", async ({ page }) => {
  await open(page, "dealer", "/dashboard");
  await page.getByRole("button", { name: "การแจ้งเตือน" }).first().click();
  await expect(page.getByText("การแจ้งเตือน", { exact: true })).toBeVisible();
  await expect(page.getByText("ดูบันทึกการใช้งานทั้งหมด")).toHaveCount(0); // ต้องไม่ใช่ audit
});

// สถานะว่างชัดเจน: ลูกค้าทั้งเครือ ค้นหาที่ไม่เจอ
test("[ux·hq] empty state ของหน้าลูกค้าทั้งเครือ", async ({ page }) => {
  await open(page, "hq", "/hq/customers");
  await page.locator('input[placeholder*="ค้นหา"]').first().fill("ลูกค้าที่ไม่มีจริง-xyz");
  await expect(page.getByText(/ไม่พบ/).first()).toBeVisible();
});
