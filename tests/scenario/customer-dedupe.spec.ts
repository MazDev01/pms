import { test, expect } from "@playwright/test";
import { ถ้ามีกล่องยืนยันให้กดตกลง } from "./helpers";
import { open } from "./helpers";
import { EXISTING_CUSTOMER_NAME } from "./global-setup";

// ลูกค้าซ้ำ (M3) — ลูกค้าเกิดได้ทางเดียวคือลูกค้าเป้าหมายที่ปิดการขายได้
// ถ้าตัวแทนเปิดลูกค้าเป้าหมายใหม่ให้บริษัทที่เป็นลูกค้าอยู่แล้ว พอปิดการขายต้องไม่แตกเป็นลูกค้าคนที่สอง
// ลูกค้าตั้งต้นมาจาก global-setup.ts (seed ผูก dealer RYG ไว้แล้ว — ดู EXISTING_CUSTOMER_NAME)

const EXISTING = EXISTING_CUSTOMER_NAME;

async function openAddLeadForm(page: import("@playwright/test").Page) {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  // บรรทัดคำอธิบายใต้หัวข้อถูกเอาออกแล้ว (28 ส.ค. 69) — ยึดกล่องแทน ชี้ชัดกว่าข้อความในกล่องอยู่แล้ว
  await expect(page.getByRole("dialog", { name: "เพิ่มลูกค้าเป้าหมาย" })).toBeVisible();
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

test("[dealer] ปิดการขายลูกค้าเป้าหมายที่ชื่อตรงกับลูกค้าเดิม → ไม่เกิดลูกค้าซ้ำ", async ({ page }) => {
  // นับจำนวนลูกค้าชื่อนี้ก่อน (ต้องมี 1)
  await open(page, "dealer", "/customers");
  // ต้อง "รอให้โผล่" ไม่ใช่ "นับทันทีที่เปิดหน้า" — รายชื่อลูกค้ามาแบบไม่พร้อมหน้า
  // นับเลยจะได้ 0 เพราะข้อมูลยังมาไม่ถึง แล้วสรุปผิดว่าไม่มีลูกค้ารายนี้ในระบบ
  const existing = page.getByText(EXISTING, { exact: true });
  await expect(existing.first(), "สมุดตั้งต้นต้องมีลูกค้ารายนี้อยู่แล้ว").toBeVisible({ timeout: 20_000 });
  const before = await existing.count();

  // เปิดลูกค้าเป้าหมายใหม่ชื่อเดียวกัน
  await openAddLeadForm(page);
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill(EXISTING);
  await page.getByPlaceholder("ชื่อผู้ติดต่อ").fill("ผู้ติดต่อทดสอบ");
  // โทรศัพท์/จังหวัด = ช่องบังคับ (บอสสั่ง 17 ส.ค. 69) — ไม่กรอกจะบันทึกไม่ผ่าน
  await page.getByPlaceholder("0XX-XXX-XXXX").fill("081-000-0000");
  await page.getByRole("dialog").getByLabel("จังหวัด").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: "บันทึก" }).click();

  // เลื่อนสถานะลูกค้าเป้าหมายใหม่ → ปิดการขายสำเร็จ (ทริกเกอร์การสร้างลูกค้า)
  await page.getByRole("button", { name: "ตาราง" }).click();
  const row = page.locator("tbody tr").filter({ hasText: "ผู้ติดต่อทดสอบ" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /▾/ }).first().click();
  // ปิดการขาย = ย้อนกลับไม่ได้ → แอปขึ้น confirm() ก่อนเสมอ (เพิ่มหลังผลตรวจสอบ /scenario 31 ก.ค. 69)
  await page.getByRole("button", { name: "ปิดการขายสำเร็จ", exact: true }).first().click();
  // อาจไม่ถามก็ได้ — ถ้ายังไม่มีใบที่ส่งให้ลูกค้า ด่านจะกันไว้ตั้งแต่ก่อนถาม (เทียบเท่าตัวดักเดิม)
  await ถ้ามีกล่องยืนยันให้กดตกลง(page);

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
