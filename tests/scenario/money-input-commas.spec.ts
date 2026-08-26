import { test, expect } from "@playwright/test";
import { open, openLeadQuotationForm } from "./helpers";

// ── ช่องกรอกจำนวนเงิน ต้องเห็นลูกน้ำระหว่างพิมพ์ (บอสสั่ง 26 ส.ค. 69) ──────────────
// ⚠️ <input type="number"> ใส่ลูกน้ำไม่ได้ (เบราว์เซอร์ถือว่าค่าไม่ใช่ตัวเลข แล้วล้างทิ้ง)
//    ช่องเงินทุกช่องจึงต้องเป็น type="text" + จัดรูปเอง — เทสต์นี้กันการเผลอเปลี่ยนกลับ
test("[ui·hq] เป้ายอดขายตัวแทน พิมพ์แล้วขึ้นลูกน้ำ", async ({ page }) => {
  await open(page, "hq", "/hq/dealers");
  const ช่อง = page.getByLabel("เป้ายอดขายทั้งปี");
  await page.getByRole("button", { name: /เพิ่มตัวแทน/ }).first().click();
  await expect(ช่อง).toBeVisible();
  await ช่อง.fill("");
  await ช่อง.pressSequentially("12000000", { delay: 20 });
  await expect(ช่อง).toHaveValue("12,000,000");
});

test("[ui·dealer] ราคาต่อหน่วยในใบเสนอราคา พิมพ์แล้วขึ้นลูกน้ำ", async ({ page }) => {
  await openLeadQuotationForm(page);
  const ราคา = page.getByLabel("ราคาต่อหน่วย").first();
  await expect(ราคา).toBeVisible();
  await ราคา.fill("");
  await ราคา.pressSequentially("250000", { delay: 20 });
  await expect(ราคา).toHaveValue("250,000");
});
