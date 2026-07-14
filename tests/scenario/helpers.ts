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

// ตรวจหน้าโหลดสมบูรณ์: มีหัวข้อ h2 + ไม่มี uncaught error + ไม่มี body เลื่อนแนวนอน
export async function assertHealthyPage(page: Page, label: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await expect(page.locator("h1, h2, h3").first(), `${label} ควรมีหัวข้อหน้า`).toBeVisible({ timeout: 12_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} ไม่ควรมี horizontal scroll (เกิน ${overflow}px)`).toBeLessThanOrEqual(3);
  expect(errors, `${label} ไม่ควรมี JS error`).toEqual([]);
}
