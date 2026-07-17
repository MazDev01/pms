import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ตรวจชั่วคราว: การ์ดข้อมูลลูกค้าไม่มีแถว "สถานะ" แล้ว และฟอร์มยังบันทึกได้ปกติ
test("การ์ดลูกค้า: ไม่มีแถวสถานะ · ฟอร์มยังทำงาน", async ({ page }) => {
  await open(page, "dealer", "/customers");
  await page.waitForTimeout(1500);
  await page.locator("tbody tr").first().click();
  await page.waitForTimeout(800);

  // โมดัลเปิดแล้ว: แถวอื่นยังครบ แต่ไม่มีป้าย "สถานะ" และไม่มีดรอปดาวน์ ใช้งาน/ไม่ใช้งาน
  await expect(page.getByText("เป็นลูกค้าเมื่อ").first()).toBeVisible();
  await expect(page.getByText("ผู้รับผิดชอบ", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("สถานะ", { exact: true })).toHaveCount(0);
  await expect(page.locator("select").filter({ hasText: "ไม่ใช้งาน" })).toHaveCount(0);
  console.log("แถวสถานะหายจากการ์ดแล้ว · แถวอื่นยังครบ");

  // ฟอร์มยังบันทึกได้
  const phone = page.locator('input[placeholder="0XX-XXX-XXXX"]').first();
  await phone.fill("086-555-4433");
  const saveBtn = page.getByRole("button", { name: "บันทึกการแก้ไข" });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await page.waitForTimeout(600);
  await expect(saveBtn).toBeDisabled(); // บันทึกแล้ว dirty หาย
  console.log("บันทึกผ่าน — ปุ่มกลับเป็น disabled");
});
