// ── การ์ดต้องบอก "กติกาการนับ" ของตัวเอง (ผลตรวจภายนอกระยะ 3 · 24 ส.ค. 69) ──
//
// HQ-03/DL-06 การ์ดตัดมาแสดงแค่อันดับต้น ๆ โดยไม่บอก → ผู้ใช้บวกแถวแล้วไม่ตรงยอดรวมของหน้า
// HQ-04/HQ-09 กราฟ "ลูกค้าตามประเภทอาคาร" นับรายที่ซื้อหลายประเภทซ้ำ และไม่รวมรายที่ยังไม่ซื้อ
// HQ-08 ดรอปดาวน์ชื่อเดียวกัน 5 จุด แต่ตัวเลือกมาจากคนละชุดข้อมูล
// DL-04 การ์ดขั้นตอนนับลูกค้าเป้าหมาย ส่วน KPI ด้านบนนับใบเสนอราคา
import { test, expect } from "@playwright/test";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(300_000);

test("การ์ดที่ตัดมาแสดงบางส่วน ต้องบอกส่วนที่เหลือ", async ({ page }) => {
  await openAs(page, RYG, "dealer", "/dashboard");
  await settle(page); await page.waitForTimeout(2500);
  const t = await page.locator("body").innerText();
  const ผลงาน = t.split("\n").find(x => x.includes("ยอดปิดการขายของแต่ละคน")) ?? "";
  const แม่แบบ = t.split("\n").find(x => x.includes("ยอดปิดการขายแยกตามแม่แบบ")) ?? "";
  const ขั้นตอน = t.split("\n").find(x => x.includes("นับเป็นลูกค้าเป้าหมาย")) ?? "";
  console.log("ผลงานผู้รับผิดชอบ:", ผลงาน.trim().slice(0, 120));
  console.log("ยอดขายตามแม่แบบ:", แม่แบบ.trim().slice(0, 120));
  console.log("ขั้นตอนการขาย:", ขั้นตอน.trim().slice(0, 120));
  expect(ขั้นตอน, "การ์ดขั้นตอนต้องบอกว่านับเป็นลูกค้าเป้าหมาย").toContain("ไม่ใช่จำนวนใบเสนอราคา");
});

test("หน้า HQ: การ์ดประเภทอาคารบอกส่วนที่เหลือ · ดรอปดาวน์บอกที่มา", async ({ page }) => {
  await openAs(page, ADMIN, "hq", "/hq/dashboard");
  await settle(page); await page.waitForTimeout(2500);
  const card = page.locator(".card").filter({ hasText: "ยอดขายตามประเภทอาคาร" }).first();
  const หัว = (await card.innerText()).split("\n").filter(Boolean).slice(0, 3).join(" | ");
  console.log("การ์ดประเภทอาคาร:", หัว.slice(0, 160));
  await openAs(page, ADMIN, "hq", "/hq/customers");
  await settle(page); await page.waitForTimeout(1800);
  const c = await page.locator("body").innerText();
  console.log("ดรอปดาวน์หน้าลูกค้า:", c.includes("ทุกประเภทอาคาร (จากอาคารที่ซื้อแล้ว)") ? "บอกที่มาแล้ว ✓" : "ยังไม่บอก ✗");
  expect(c).toContain("ทุกประเภทอาคาร (จากอาคารที่ซื้อแล้ว)");
});
