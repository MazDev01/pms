// ── เข้าระบบแล้วต้องอยู่ต่อไปจนกว่าจะกดออกเอง (บอสสั่ง 20 ส.ค. 69) ────────────
//
// เดิมแอปถามครั้งเดียวตอนเปิดหน้าว่า "ยังล็อกอินอยู่ไหม" ถ้าถามไม่สำเร็จ = ถือว่าไม่ได้ล็อกอิน
//   แล้วเด้งไปหน้าเข้าสู่ระบบทันที · เน็ตสะดุดแวบเดียวตอนโหลดหน้า = โดนเตะออก
//   ทั้งที่ใบผ่านยังอยู่ครบในเครื่องและยังต่ออายุได้ตามปกติ
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { DEALER_ORIGIN, loginUI } from "./funcHelpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

test("[auth] เน็ตสะดุดตอนเปิดหน้า → ต้องยังอยู่ในระบบ ไม่เด้งไปหน้าเข้าสู่ระบบ", async ({ page, context }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await expect(page).not.toHaveURL(/\/login/);

  // ทำให้ใบผ่านที่ถืออยู่ "หมดอายุ" เพื่อบังคับให้ต้องต่ออายุตอนเปิดหน้า
  //   (ใบยังไม่หมดอายุ = อ่านจากเครื่องได้เลย ไม่ต้องคุยกับเซิร์ฟเวอร์ ซึ่งก็อยู่ในระบบต่อได้อยู่แล้ว)
  //   กุญแจต่ออายุยังอยู่ครบ — สถานการณ์นี้คือ "ยังล็อกอินอยู่ แค่ต้องขอใบใหม่"
  await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) as string);
      v.expires_at = Math.floor(Date.now() / 1000) - 60;   // หมดอายุไปแล้ว 1 นาที
      localStorage.setItem(k, JSON.stringify(v));
    }
  });

  // ตัดคำขอไปที่ระบบยืนยันตัวตน = จำลองเน็ตสะดุด/เซิร์ฟเวอร์ตอบไม่ได้ตอนขอใบใหม่
  await context.route("**/auth/v1/**", r => r.abort());
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });

  // สิ่งที่ต้องเป็นจริงเสมอ: ไม่ถูกเตะออกไปหน้าเข้าสู่ระบบ และหน้าจอใช้งานได้ตามปกติ
  //   (ถ้าตอบไม่ได้จริง ๆ แอปจะขึ้น "กำลังเชื่อมต่อ" แทน ซึ่งก็ยังไม่ใช่การเตะออก
  //    จึงยอมรับได้ทั้งสองแบบ — ที่ยอมไม่ได้คือเด้งไปหน้าเข้าสู่ระบบ)
  await page.waitForTimeout(6000);
  await expect(page, "เน็ตสะดุด ≠ ออกจากระบบ").not.toHaveURL(/\/login/);
  const กำลังเชื่อมต่อ = await page.getByText("กำลังเชื่อมต่อ").isVisible().catch(() => false);
  if (!กำลังเชื่อมต่อ) {
    await expect(page.getByRole("link", { name: "ลูกค้าเป้าหมาย" }).first(),
      "ไม่ได้ขึ้น 'กำลังเชื่อมต่อ' ก็ต้องใช้งานหน้าจอได้ตามปกติ").toBeVisible({ timeout: 20_000 });
  }

  // เน็ตกลับมา → ต้องยังอยู่ในระบบและใช้งานต่อได้ โดยไม่ต้องล็อกอินใหม่
  await context.unroute("**/auth/v1/**");
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await expect(page, "กลับมาแล้วต้องยังอยู่ในระบบ").not.toHaveURL(/\/login/);
  await expect(page.getByRole("link", { name: "ลูกค้าเป้าหมาย" }).first()).toBeVisible({ timeout: 30_000 });
});

test("[auth] ปิดแท็บแล้วเปิดใหม่ → ยังอยู่ในระบบ", async ({ page, context }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await expect(page).not.toHaveURL(/\/login/);

  const แท็บใหม่ = await context.newPage();
  await แท็บใหม่.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await expect(แท็บใหม่, "เปิดแท็บใหม่ต้องไม่ต้องล็อกอินซ้ำ").not.toHaveURL(/\/login/);
  await แท็บใหม่.close();
});
