import { test, expect } from "@playwright/test";
import { open } from "./helpers";

// ─── Persona: UI Expert ───────────────────────────────────────────────────────
// "เลย์เอาต์แตกไหม · responsive ไหม · ไม่มี body เลื่อนแนวนอน · หัวข้อครบ"

const PAGES: [("hq" | "dealer"), string, string][] = [
  ["dealer", "/dashboard", "แดชบอร์ดตัวแทน"],
  ["dealer", "/leads", "ลูกค้าเป้าหมาย"],
  ["dealer", "/quotations", "ใบเสนอราคา"],
  ["hq", "/hq/dashboard", "แดชบอร์ด HQ"],
  ["hq", "/hq/pipeline", "ภาพรวมยอดขาย"],
  ["hq", "/hq/settings", "ตั้งค่า HQ"],
  ["hq", "/hq/audit", "บันทึกการใช้งาน"],
];

// เดสก์ท็อป: ไม่มี horizontal overflow
for (const [role, path, label] of PAGES) {
  test(`[ui·desktop] ${label} ไม่มี body เลื่อนแนวนอน`, async ({ page }) => {
    await open(page, role, path);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${label}: overflow ${overflow}px`).toBeLessThanOrEqual(3);
  });
}

// count-up ของ KPI ต้องเรนเดอร์ค่าครบ (ไม่ค้าง 0 / ไม่พังเป็นว่าง)
test("[ui·hq] KPI count-up แสดงค่าครบ", async ({ page }) => {
  await open(page, "hq", "/hq/dealers");
  await expect(page.locator(".stat-value").first()).toContainText("ตัวแทน");
});

// modal ต้องยึด viewport เต็มจอ (กันบั๊ก: แอนิเมชันหน้าเผลอใส่ transform ที่ .erp → fixed ยึด .erp แทนจอ)
test("[ui·desktop] modal ลูกค้า HQ ครอบเต็มจอ (fixed ยึด viewport)", async ({ page }) => {
  await open(page, "hq", "/hq/customers");
  await page.locator("table tbody tr").first().click();
  // รอโมดัลขึ้นจริงก่อนวัด — ใช้ "รหัสลูกค้า" ในแท็บโปรไฟล์เป็นหมุด (ป้าย "Data Ownership" เหลือแค่คอมเมนต์ในโค้ดแล้ว)
  // (คำเดียวกันเป็นหัวคอลัมน์ในตารางเบื้องหลังด้วย จึงต้อง .first())
  await expect(page.getByText("รหัสลูกค้า").first()).toBeVisible();
  const rect = await page.evaluate(() => {
    const ov = [...document.querySelectorAll<HTMLElement>("div")].find(d => {
      const s = getComputedStyle(d);
      return s.position === "fixed" && parseFloat(s.zIndex) >= 200 && d.getBoundingClientRect().width > 300;
    });
    if (!ov) return null;
    const r = ov.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, vw: window.innerWidth };
  });
  expect(rect, "หา overlay ไม่เจอ").not.toBeNull();
  // ยึดมุมซ้ายบนของจอ + กว้างเท่าจอ (ถ้าบั๊ก .erp transform จะเลื่อนขวา/แคบลง)
  expect(Math.abs(rect!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(rect!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(rect!.w - rect!.vw)).toBeLessThanOrEqual(2);
});

// KPI cards ของ HQ ทุกแบบต้องมีแอนิเมชันเข้า ทุกหน้า
// ไม่ล็อกชื่อคีย์เฟรมตัวเดียว — ดีไซน์ตอนนี้ใช้ "chart-fade-in" (จางเข้าเฉย ๆ ตามแนว calm enterprise
// ที่ globals.css เขียนกำกับไว้ว่า no rise, no stagger) ส่วน "cardIn" (เลื่อนขึ้น+จาง) ยังใช้กับการ์ดอื่นอยู่
// สิ่งที่ต้องกันคือ "ไม่มีแอนิเมชันเข้าเลย" (none)
const ENTRANCE_ANIMS = ["cardIn", "chart-fade-in"];
for (const [path, selector, label] of [
  ["/hq/dealers", ".stat-grid > .stat-card", "หน้าตัวแทน (.stat-card)"],
  ["/hq/master", ".hqx-kpis > .hqx-kpi", "หน้าแม่แบบ (.hqx-kpi)"],
] as const) {
  test(`[ui·hq] KPI cards ${label} มีแอนิเมชันเข้า`, async ({ page }) => {
    await open(page, "hq", path);
    const card = page.locator(selector).first();
    await expect(card).toBeVisible();
    const anim = await card.evaluate(el => getComputedStyle(el).animationName);
    expect(ENTRANCE_ANIMS, `${label}: ต้องมี entrance animation (ได้: ${anim})`).toContain(anim);
  });
}

// แท็บเล็ต (768) : เลย์เอาต์ต้องไม่ล้น
for (const [role, path, label] of PAGES.slice(0, 5)) {
  test(`[ui·tablet] ${label} responsive ที่ 768px`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, role, path);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${label}@768: overflow ${overflow}px`).toBeLessThanOrEqual(3);
  });
}
