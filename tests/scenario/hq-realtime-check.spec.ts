import { test, expect } from "@playwright/test";
import { RYG, ADMIN, skipReason } from "./supabaseEnv";
import { DEALER_ORIGIN, HQ_ORIGIN, loginUI, db, cleanup, specNS, nsTag } from "./funcHelpers";

// ── ยืนยันว่า HQ Dashboard อัปเดต "โดยไม่ต้องรีเฟรชเอง" จริงไหม (ไม่ใช่แค่ถูกต้องตอน navigate ใหม่) ──
// เปิด HQ dashboard ค้างไว้ 1 แท็บ แล้วให้ตัวแทนสร้างลูกค้าใหม่ผ่านอีกช่องทาง (ตรงผ่าน DB จำลอง
// การเขียนจริงจากฝั่งตัวแทน) แล้วจับเวลาว่าตัวเลขบนแท็บ HQ ที่เปิดค้างไว้เปลี่ยนเองภายในกี่วินาที
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(60_000);

const NS = specNS("HQRT");
const tg = nsTag(NS);

test.beforeAll(async () => { await cleanup(await db(RYG), "RYG", NS); });
test.afterAll(async () => { await cleanup(await db(RYG), "RYG", NS); });

test("[realtime] HQ dashboard เปิดค้างไว้ → ตัวเลขลูกค้าทั้งเครือขยับเองโดยไม่ต้องรีเฟรช เมื่อตัวแทนเพิ่มลูกค้าใหม่", async ({ page }) => {
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const kpiLocator = page.locator(".card").filter({ hasText: "ลูกค้าทั้งเครือ" }).first();
  await expect(kpiLocator).toBeVisible({ timeout: 15_000 });
  const before = (await kpiLocator.innerText()).trim();
  console.log(`[realtime] ตัวเลขก่อนตัวแทนเพิ่มลูกค้า: "${before.replace(/\n/g, " | ")}"`);

  // ให้ RYG เพิ่มลูกค้าใหม่จริงผ่านช่องทางที่แอปใช้จริง (RPC atomic เดียวกับที่ฟอร์มเรียก) —
  // ไม่ผ่าน UI ของตัวแทน กันตัวแปรเรื่องความเร็ว UI ปน กับสิ่งที่ทดสอบจริง (ความเร็ว realtime ฝั่ง HQ)
  const sb = await db(RYG);
  const { error } = await sb.rpc("upsert_customer_for_company", {
    p_dealer: "RYG",
    p_payload: {
      name: "คุณเรียลไทม์", company: tg("ลูกค้าเรียลไทม์"), email: "", phone: "",
      province: "ระยอง", category: "โกดังสำเร็จรูป", status: "active",
      projects: 0, join_date: new Date().toISOString().slice(0, 10), owner: "ทดสอบ",
      initials: "RT", color: "#003366",
    },
  });
  if (error) throw new Error(`สร้างลูกค้าทดสอบไม่สำเร็จ: ${error.message}`);
  const insertedAt = Date.now();

  // จับเวลาว่าตัวเลขบน HQ dashboard ที่เปิดค้างไว้ (ไม่ได้กด reload/navigate เอง) เปลี่ยนเองภายในกี่วินาที
  let changedAfterMs: number | null = null;
  for (let i = 0; i < 20; i++) {
    const now = (await kpiLocator.innerText()).trim();
    if (now !== before) { changedAfterMs = Date.now() - insertedAt; break; }
    await page.waitForTimeout(500);
  }

  if (changedAfterMs !== null) {
    console.log(`[realtime] ✅ ตัวเลขบน HQ dashboard เปลี่ยนเอง (ไม่รีเฟรช) ภายใน ${changedAfterMs}ms`);
  } else {
    console.log(`[realtime] ❌ ตัวเลขบน HQ dashboard ไม่เปลี่ยนเองภายใน 10 วินาที (ต้องรีเฟรช/navigate เองถึงจะเห็นค่าใหม่)`);
  }
  expect(changedAfterMs, "HQ dashboard ควรอัปเดตเองโดยไม่ต้องรีเฟรชภายในเวลาอันสมควร").not.toBeNull();
});
