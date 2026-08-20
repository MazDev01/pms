// ── ลากการ์ดบนกระดาน: กระดานต้องเลื่อนตาม และช่องวางต้องอยู่ท้ายรายการ ──────────
// (บอสสั่ง 20 ส.ค. 69) คอลัมน์รวมกันกว้างเกินจอ ถ้ากระดานไม่เลื่อนตามตอนลาก
// จะย้ายการ์ดไปคอลัมน์ที่มองไม่เห็นไม่ได้เลย เพราะปล่อยเมาส์ = วางการ์ดทันที
//
// ⚠️ เมาส์สังเคราะห์ของ Playwright ไม่ทำให้เกิด event ของการลาก-วางแบบ HTML5
//    จึงต้องยิง dragstart/dragover เองตรง ๆ (พร้อม DataTransfer ของจริง เพราะโค้ดใช้มัน)
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

test("[ui·dealer] ลากการ์ดไปชิดขอบ — และลากเลยขอบออกไป — กระดานต้องเลื่อนตาม", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });   // แคบพอให้คอลัมน์ท้ายหลุดจอ
  await openAs(page, RYG, "dealer", "/leads");
  await settle(page);
  await page.getByRole("button", { name: "บอร์ด" }).click();

  const การ์ด = page.locator('[draggable="true"]').first();
  await expect(การ์ด, "ต้องมีการ์ดให้ลากอย่างน้อยหนึ่งใบ").toBeVisible({ timeout: 30_000 });

  const กระดาน = page.locator('div[style*="overflow-x: auto"]').filter({ has: page.locator('[draggable="true"]') }).first();

  // ยิงที่ document ครั้งเดียวแล้วปล่อยรอ = จำลองผู้ใช้ที่ค้างเมาส์ไว้ที่ขอบโดยไม่ขยับ
  const ค้างเมาส์ที่ = (ที่: "ขอบขวาด้านใน" | "พ้นขอบซ้ายออกไป") => กระดาน.evaluate((el, ที่) => {
    const r = el.getBoundingClientRect();
    const x = ที่ === "ขอบขวาด้านใน" ? r.right - 20 : r.left - 120;
    document.dispatchEvent(new DragEvent("dragover", {
      bubbles: true, cancelable: true, clientX: Math.round(x), clientY: Math.round(r.top + 100),
    }));
  }, ที่);

  const เลื่อนก่อน = await กระดาน.evaluate(el => el.scrollLeft);
  await ค้างเมาส์ที่("ขอบขวาด้านใน");
  await page.waitForTimeout(1000);
  const เลื่อนหลัง = await กระดาน.evaluate(el => el.scrollLeft);
  expect(เลื่อนหลัง, "ค้างการลากไว้ที่ขอบขวาแล้วกระดานต้องเลื่อนตาม").toBeGreaterThan(เลื่อนก่อน);

  // ★ กรณีที่บอสเจอ: ลากเลยขอบกระดานออกไปเลย (ไปทับแถบเมนูข้าง) ต้องยังเลื่อนตาม ไม่ใช่หยุด
  await ค้างเมาส์ที่("พ้นขอบซ้ายออกไป");   // ไปทับแถบเมนูข้าง
  await page.waitForTimeout(800);
  const เลื่อนกลับ = await กระดาน.evaluate(el => el.scrollLeft);
  expect(เลื่อนกลับ, "ลากออกไปนอกกระดานทางซ้ายแล้วกระดานต้องเลื่อนกลับตาม").toBeLessThan(เลื่อนหลัง);

  // ปล่อยแล้วต้องหยุดเลื่อน ไม่ใช่ไหลต่อเอง
  await กระดาน.evaluate(el => el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true })));
  const หลังปล่อย1 = await กระดาน.evaluate(el => el.scrollLeft);
  await page.waitForTimeout(600);
  const หลังปล่อย2 = await กระดาน.evaluate(el => el.scrollLeft);
  expect(หลังปล่อย2, "ปล่อยการ์ดแล้วกระดานต้องหยุดเลื่อน").toBe(หลังปล่อย1);
});
