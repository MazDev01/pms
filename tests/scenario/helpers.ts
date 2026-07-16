import { Page, expect } from "@playwright/test";

// สลับ role ก่อนโหลดหน้า (RoleProvider อ่านจาก localStorage ตอน mount)
export async function loginAs(page: Page, role: "hq" | "dealer") {
  await page.addInitScript((r) => {
    localStorage.setItem("pms_session_key", r as string);
    localStorage.setItem("pms_logged_in", "true");
  }, role);
}

export async function open(page: Page, role: "hq" | "dealer", path: string) {
  await loginAs(page, role);
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

// เปิดฟอร์ม "สร้างใบเสนอราคาใหม่" — ตอนนี้อยู่ในแผงรายละเอียดลูกค้าเป้าหมาย (แท็บใบเสนอราคา)
// wizard เดิมบนหน้า /quotations ถูกลบทั้งฟีเจอร์ → ตัวแทนออกใบจากลีดเท่านั้น
export async function openLeadQuotationForm(page: Page) {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง
  await page.getByRole("button", { name: "ดูรายละเอียด" }).first().click();
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: true }).first().click();
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).first().click();
  await expect(page.getByText("สร้างใบเสนอราคาใหม่")).toBeVisible();
}

// ตรวจหน้าโหลดสมบูรณ์: มีหัวข้อ h2 + ไม่มี uncaught error + ไม่มี body เลื่อนแนวนอน
export async function assertHealthyPage(page: Page, label: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await expect(page.locator("h1, h2, h3").first(), `${label} ควรมีหัวข้อหน้า`).toBeVisible({ timeout: 12_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} ไม่ควรมี horizontal scroll (เกิน ${overflow}px)`).toBeLessThanOrEqual(3);
  expect(errors, `${label} ไม่ควรมี JS error`).toEqual([]);
}
