import { test, expect } from "@playwright/test";
import { open } from "./helpers";
import { EXISTING_CUSTOMER_NAME } from "./global-setup";

// ลูกค้าซ้ำ (M3) — ลูกค้าเกิดได้ทางเดียวคือลีดที่ปิดการขายได้
// ถ้าตัวแทนเปิดลีดใหม่ให้บริษัทที่เป็นลูกค้าอยู่แล้ว พอปิดการขายต้องไม่แตกเป็นลูกค้าคนที่สอง
// ลูกค้าตั้งต้นมาจาก global-setup.ts (seed ผูก dealer RYG ไว้แล้ว — ดู EXISTING_CUSTOMER_NAME)

const EXISTING = EXISTING_CUSTOMER_NAME;

async function openAddLeadForm(page: import("@playwright/test").Page) {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  await expect(page.getByText("กรอกข้อมูลลูกค้าเป้าหมาย")).toBeVisible();
}

test("[dealer] ชื่อบริษัทตรงกับลูกค้าเดิม → ฟอร์มเตือนว่าจะผูกเข้ากับรายเดิม", async ({ page }) => {
  await openAddLeadForm(page);
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill(EXISTING);
  await expect(page.getByText("เป็นลูกค้าอยู่แล้ว")).toBeVisible();
});

test("[dealer] ชื่อต่างแค่คำนำหน้านิติบุคคล → เตือนว่าใกล้เคียง ไม่ฟันธงแทนผู้ใช้", async ({ page }) => {
  await openAddLeadForm(page);
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill("บริษัท ไทยสตีล จำกัด");
  await expect(page.getByText("ชื่อใกล้เคียงกับลูกค้าเดิม")).toBeVisible();
});

test("[dealer] ชื่อบริษัทใหม่จริง ๆ → ไม่มีคำเตือน", async ({ page }) => {
  await openAddLeadForm(page);
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill("บจ. ยังไม่เคยมีในระบบ 9999");
  await expect(page.getByText("เป็นลูกค้าอยู่แล้ว")).toHaveCount(0);
  await expect(page.getByText("ชื่อใกล้เคียงกับลูกค้าเดิม")).toHaveCount(0);
});

test("[dealer] ปิดการขายลีดที่ชื่อตรงกับลูกค้าเดิม → ไม่เกิดลูกค้าซ้ำ", async ({ page }) => {
  // นับจำนวนลูกค้าชื่อนี้ก่อน (ต้องมี 1)
  await open(page, "dealer", "/customers");
  const before = await page.getByText(EXISTING, { exact: true }).count();
  expect(before, "สมุดตั้งต้นต้องมีลูกค้ารายนี้อยู่แล้ว").toBeGreaterThan(0);

  // เปิดลีดใหม่ชื่อเดียวกัน
  await openAddLeadForm(page);
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill(EXISTING);
  await page.getByPlaceholder("ชื่อผู้ติดต่อ").fill("ผู้ติดต่อทดสอบ");
  await page.getByRole("button", { name: "บันทึก" }).click();

  // เลื่อนสถานะลีดใหม่ → ปิดการขายสำเร็จ (ทริกเกอร์การสร้างลูกค้า)
  await page.getByRole("button", { name: "ตาราง" }).click();
  const row = page.locator("tbody tr").filter({ hasText: "ผู้ติดต่อทดสอบ" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /▾/ }).first().click();
  // ปิดการขาย = ย้อนกลับไม่ได้ → แอปขึ้น confirm() ก่อนเสมอ (เพิ่มหลังผลตรวจสอบ /scenario 31 ก.ค. 69)
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "ปิดการขายสำเร็จ", exact: true }).first().click();

  // สมุดลูกค้าต้องยังมีรายนี้เท่าเดิม (ผูกเข้ากับรายเดิม ไม่สร้างใหม่)
  await open(page, "dealer", "/customers");
  // เช็คที่ตัวเก็บข้อมูลเป็นหลัก — จำนวนบนจอเชื่อทันทีไม่ได้ เฟรมแรกยังเป็นชุด seed ก่อนโหลดจาก store
  // (ยังไม่มีคีย์ = ไม่เคยมีการสร้างลูกค้าเลย = ผ่าน)
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("sales_customers_v1");
    if (!raw) return 0;
    return (JSON.parse(raw) as { company: string }[]).filter(c => c.company === "บจ. ไทยสตีล").length;
  });
  expect(stored, "ต้องไม่มีลูกค้าชื่อซ้ำถูกบันทึกเพิ่ม").toBeLessThanOrEqual(1);
  // แล้วค่อยยืนยันบนจอหลังข้อมูลจริงโหลดเสร็จ
  await page.waitForTimeout(800);
  await expect(page.getByText(EXISTING, { exact: true }),
    "ต้องไม่มีลูกค้าชื่อซ้ำโผล่บนหน้าจอ").toHaveCount(before);
});
