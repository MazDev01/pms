import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ─── จอมือถือ (บอสสั่ง 24 ส.ค. 69) ────────────────────────────────────────────
// เดิมทดสอบแคบสุดแค่ 768px (แท็บเล็ต) — ถ้าเซลส์เปิดจากมือถือหน้างานจะไม่มีอะไรกันไว้เลย
// 390px = iPhone รุ่นมาตรฐาน · เกณฑ์: หน้าต้องไม่เลื่อนแนวนอน และต้องมีหัวข้อหน้าให้เห็น
//
// ⚠️ ยอมให้ล้นได้ไม่เกิน 3px เท่ากับเทสต์เดสก์ท็อป/แท็บเล็ต — เป็นเศษจากเส้นขอบ ไม่ใช่ของล้นจริง
const MOBILE = { width: 390, height: 844 };

const PAGES: [("hq" | "dealer"), string, string][] = [
  ["dealer", "/dashboard", "แดชบอร์ดตัวแทน"],
  ["dealer", "/leads", "ลูกค้าเป้าหมาย"],
  ["dealer", "/quotations", "ใบเสนอราคา"],
  ["dealer", "/customers", "ลูกค้าของตัวแทน"],
  ["hq", "/hq/dashboard", "แดชบอร์ด HQ"],
  ["hq", "/hq/pipeline", "ภาพรวมยอดขาย"],
  ["hq", "/hq/customers", "ลูกค้าทั้งเครือ"],
  ["hq", "/hq/dealers", "ตัวแทน"],
];

for (const [role, path, label] of PAGES) {
  test(`[ui·mobile] ${label} ที่ 390px ต้องไม่ล้นออกนอกจอ`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await open(page, role, path);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    const เกิน = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(เกิน, `${label}@390: ล้นออกนอกจอ ${เกิน}px`).toBeLessThanOrEqual(3);
  });
}

// เมนูซ้ายบนมือถือถูกเลื่อนออกนอกจอ (left:-248) แล้วมีปุ่มเปิด — ต้องเปิดได้จริงและกดไปหน้าอื่นได้
// ไม่งั้นผู้ใช้บนมือถือจะติดอยู่หน้าเดียวตลอด (เดสก์ท็อปไม่เจอเพราะเมนูค้างอยู่เสมอ)
test("[ui·mobile] เมนูบนมือถือ ต้องเปิดได้และกดไปหน้าอื่นได้", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await open(page, "dealer", "/dashboard");

  const เมนูซ้าย = page.locator("aside").first();
  await expect(เมนูซ้าย).toBeAttached();
  // ตอนยังไม่กด: ต้องหลบออกนอกจอ ไม่ใช่ทับเนื้อหา
  const ก่อนกด = await เมนูซ้าย.evaluate(el => Math.round(el.getBoundingClientRect().right));
  expect(ก่อนกด, `เมนูซ้ายต้องหลบออกนอกจอตอนยังไม่เปิด (ขอบขวาอยู่ที่ ${ก่อนกด}px)`).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: /เมนู|menu/i }).first().click();
  await expect.poll(() => เมนูซ้าย.evaluate(el => Math.round(el.getBoundingClientRect().right)))
    .toBeGreaterThan(0);

  await เมนูซ้าย.getByRole("link", { name: /ลูกค้าเป้าหมาย/ }).first().click();
  await expect(page).toHaveURL(/\/leads/);
});
