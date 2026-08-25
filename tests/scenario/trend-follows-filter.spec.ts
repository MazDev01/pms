import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ─── กราฟยอดขายรวมทั้งเครือ ต้องเดินตามแถบกรองเวลา (บอสสั่ง 25 ส.ค. 69) ─────────
// เลือกช่วงสั้น (วันนี้ / 7 วันล่าสุด / เดือนนี้) → จุดละวัน · เลือกปีนี้ → จุดละเดือน
// ⚠️ ละเอียดกว่าวันไม่ได้ ระบบเก็บวันปิดการขายเป็น "วัน" ไม่มีเวลานาฬิกา

async function เลือกช่วง(page: import("@playwright/test").Page, ชื่อ: string) {
  await page.getByRole("button", { name: /2569/ }).first().click();
  await page.getByRole("button", { name: ชื่อ, exact: true }).first().click();
  await page.waitForTimeout(1200);
}

test("[func·hq] เลือก 'ปีนี้' → กราฟเป็นรายเดือน · เลือก '7 วันล่าสุด' → กราฟเป็นรายวัน", async ({ page }) => {
  await open(page, "hq", "/hq/dashboard");

  // หน้านี้มีกราฟแนวโน้มหลายใบ — ต้องเจาะเฉพาะการ์ด "ยอดขายรวมทั้งเครือ" ใบเดียว
  const การ์ด = () => page.locator(".card").filter({ hasText: /ยอดขายรวมทั้งเครือ|ยอดขาย .* ราย/ }).first();

  await เลือกช่วง(page, "ปีนี้");
  await expect(การ์ด().getByText(/รายเดือน/).first()).toBeVisible();
  // ⚠️ ห้ามมีปุ่มช่วงของกราฟเอง — ตัวคุมเวลาต้องมีตัวเดียวคือแถบกรองด้านบน (บอสทัก 25 ส.ค. 69)
  await expect(การ์ด().getByRole("button", { name: /^\d+ เดือน$/ })).toHaveCount(0);
  await expect(การ์ด().getByText(/เดือนในช่วงที่เลือก/)).toBeVisible();

  await เลือกช่วง(page, "7 วันล่าสุด");
  await expect(การ์ด().getByText(/รายวัน/).first()).toBeVisible();
  await expect(การ์ด().getByText(/วันในช่วงที่เลือก/)).toBeVisible();
});
