import { test, expect } from "@playwright/test";
import { open, settle } from "./helpers";

// บอสแจ้ง: กด "ล้างตัวกรอง" แล้วข้อมูลหาย — ล้างต้องเห็นข้อมูลมากขึ้น ไม่ใช่น้อยลง
test("[dealer] ล้างตัวกรองแล้วต้องไม่มีแถวหายไป", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 950 });
  await open(page, "dealer", "/customers");
  await settle(page);
  const นับแถว = async () => page.locator("tbody tr").count();
  const เริ่มต้น = await นับแถว();

  // แคบช่วงเวลาเป็น "เดือนนี้"
  const ปุ่มเวลา = page.locator("button").filter({ hasText: /2569|ปีนี้|เดือนนี้|ทุกช่วงเวลา/ }).first();
  await ปุ่มเวลา.click();
  await page.getByRole("button", { name: "เดือนนี้" }).click();
  await page.waitForTimeout(600);
  const แคบ = await นับแถว();
  expect(แคบ).toBeLessThanOrEqual(เริ่มต้น);

  // ล้างตัวกรอง → ต้องไม่น้อยกว่าตอนเริ่ม (ล้าง = ไม่กรองเวลา)
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).first().click();
  await page.waitForTimeout(800);
  const หลังล้าง = await นับแถว();
  expect(หลังล้าง, "ล้างแล้วแถวต้องไม่หายไป").toBeGreaterThanOrEqual(เริ่มต้น);
  await expect(ปุ่มเวลา).toContainText("ทุกช่วงเวลา");
});
