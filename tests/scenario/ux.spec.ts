import { test, expect } from "@playwright/test";
import { กดยกเลิกในกล่องยืนยัน } from "./helpers";
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
  await page.locator(HQ_SETTINGS_NAV).getByRole("button", { name: /บริษัท/ }).click();
  expect(await กดยกเลิกในกล่องยืนยัน(page)).toContain("ยังไม่บันทึก");
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

// ป้ายเจ้าของ+มงกุฎ: อยู่ที่ก้น sidebar · ชื่อบทบาทต่างกันตามสิทธิ์
//
// ⚠️ คำที่ใช้เปลี่ยนเมื่อ 10 ส.ค. 69 โดยตั้งใจ — เดิม "เจ้าของแพลตฟอร์ม"/"เจ้าของบัญชีตัวแทน"
//   ซึ่งเป็นคนละคำกับที่แถบบนขวาเรียกคนคนเดียวกัน ("ผู้ดูแลระบบ"/"ผู้จัดการตัวแทน")
//   ผู้ใช้เห็นตัวเองถูกเรียกสองชื่อพร้อมกันในจอเดียว → รวมมาใช้แหล่งเดียว (roleLabelOf)
//   เทสต์นี้จึงเปลี่ยนตามข้อกำหนดใหม่ ไม่ใช่แก้เพื่อให้ผ่าน
test("[ux·hq] ก้น sidebar แสดงชื่อบทบาทตรงกับแถบบน", async ({ page }) => {
  await open(page, "hq", "/hq/dashboard");
  // ชื่อบัญชีผู้ดูแลบังเอิญเป็นคำเดียวกับชื่อบทบาท → เจอสองจุดในการ์ดเดียว ใช้ตัวแรกพอ
  await expect(page.locator(".sidebar-footer").getByText("ผู้ดูแลระบบ").first()).toBeVisible();
  // ต้องไม่กลับไปใช้คำเก่าที่ขัดกับแถบบนอีก
  await expect(page.getByText("เจ้าของแพลตฟอร์ม")).toHaveCount(0);
});
test("[ux·dealer] ก้น sidebar ของตัวแทนต้องไม่ใช่ชื่อบทบาทของสำนักงานใหญ่", async ({ page }) => {
  await open(page, "dealer", "/dashboard");
  await expect(page.locator(".sidebar-footer").getByText("ผู้จัดการตัวแทน")).toBeVisible();
  await expect(page.getByText("ผู้ดูแลระบบ")).toHaveCount(0);
  await expect(page.getByText("เจ้าของบัญชีตัวแทน")).toHaveCount(0);
});

// ⚠️ เดิมเทสต์นี้คาดว่าตัวแทน "พิมพ์คำนำหน้าเลขที่เองได้" (มองหาช่องกรอกที่ขึ้นต้นด้วย Q-)
//   แต่ภายหลังตัดสินใจ **ล็อกคำนำหน้าเป็นรูปแบบเดียวทั้งระบบ** Q-{รหัสสาขา}-{ปี}- โดยตั้งใจ
//   เพราะสาขาที่พิมพ์เองจะได้เลขที่ไม่ตรงกับที่ระบบออกจริงตอนสร้างใบ
//   เทสต์จึงตกทั้งที่โค้ดถูก — ตอนนี้เปลี่ยนมาตรวจ "กติกาที่ใช้จริง" แทน
//
// สรุปกติกาปัจจุบัน: คำนำหน้า = ระบบล็อก · เลขลำดับกับอายุใบ = ตัวแทนตั้งเอง · VAT = สำนักงานใหญ่กำหนด
test("[ux·dealer] คำนำหน้าเลขที่ใบเสนอราคาถูกล็อก · เลขลำดับตัวแทนตั้งเอง · VAT มาจากสำนักงานใหญ่", async ({ page }) => {
  await open(page, "dealer", "/settings");
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: false }).first().click();

  // คำนำหน้าเป็นกล่องอ่านอย่างเดียว ไม่ใช่ช่องกรอก — และต้องเป็นรูปแบบของระบบ
  const prefix = page.getByTestId("quote-prefix");
  await expect(prefix).toBeVisible();
  await expect(prefix).toHaveText(/^Q-[A-Z]{3}-\d{4}-$/);
  await expect(page.locator('input[data-testid="quote-prefix"]'), "คำนำหน้าต้องแก้ไม่ได้").toHaveCount(0);

  // เลขลำดับถัดไป = ตัวแทนตั้งเองได้จริง (ต้องเป็นช่องกรอกที่ไม่ถูกปิด)
  const running = page.locator('input[type="number"]').first();
  await expect(running).toBeEditable();

  // VAT ยังกำหนดโดยสำนักงานใหญ่
  await expect(page.getByText("ภาษีมูลค่าเพิ่ม %")).toBeVisible();
});

// ฟอร์มเพิ่มลูกค้าเป้าหมาย: เลือกขั้นได้เฉพาะก่อน "เสนอราคา" (ขั้นเสนอราคาต้องมีใบก่อน)
test("[ux·dealer] ฟอร์มเพิ่มลูกค้าเป้าหมายไม่มีขั้น 'เสนอราคา'", async ({ page }) => {
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
  await page.getByRole("button", { name: "ผู้รับผิดชอบ" }).click();
  expect(await กดยกเลิกในกล่องยืนยัน(page)).toContain("ยังไม่บันทึก");
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
