import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { HQ_ORIGIN, DEALER_ORIGIN, db, loginUI, watchErrors, assertNoErrors } from "./funcHelpers";

// ── ลบสาขาแล้ว บัญชีของสาขานั้นต้องใช้งานระบบต่อไม่ได้ (ผู้ใช้แจ้ง 14 ส.ค. 69) ──────
//
// อาการเดิม: สำนักงานใหญ่ลบสาขาไปแล้ว — ทะเบียนหาย บัญชีเข้าระบบถูกลบจริง — แต่เบราว์เซอร์
//   ที่ยังถือใบผ่าน (JWT) ใบเดิมยังเปิดหน้าในระบบได้ต่อจนกว่าใบจะหมดอายุ (นานถึง 1 ชม.)
//   ทุกคำขอข้อมูลถูกฐานข้อมูลปฏิเสธ หน้าจอจึงว่างเปล่า ผู้ใช้เห็นเป็น "ระบบพัง" ไม่ใช่ "ถูกลบสิทธิ์"
//   ต้นเหตุ: การฟื้น session อ่านจากใบผ่านในเครื่องอย่างเดียว ไม่เคยถามว่าบัญชี/สาขายังอยู่ไหม
//
// เทสต์นี้ล็อกทั้งสองด้านไว้:
//   1. สาขาถูกลบ → หน้าที่เปิดค้างต้องเด้งออกไปหน้าเข้าสู่ระบบ
//   2. สาขาที่ยังอยู่ → ต้องใช้งานได้ตามปกติ (กันการแก้เผลอเด้งคนที่ยังมีสิทธิ์ออก)
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const CODE = "ZTG"; // รหัสสาขาทดสอบเฉพาะไฟล์นี้ — ไม่ชนกับ CNX/RYG/UBN ของจริง
const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function adminToken() {
  return (await (await db(ADMIN)).auth.getSession()).data.session?.access_token ?? "";
}
/** เก็บกวาดสาขาทดสอบ + บัญชีของมัน — ต้องลบบัญชี auth ด้วย ไม่งั้นรอบถัดไปสร้างไม่ได้ (อีเมลซ้ำ) */
async function purge() {
  const { data: profs } = await admin.from("profiles").select("id").eq("dealer_code", CODE);
  for (const p of profs ?? []) await admin.auth.admin.deleteUser(String(p.id)).catch(() => {});
  await admin.from("dealers").delete().eq("code", CODE);
}

test.beforeAll(purge);
test.afterAll(purge);

test("[auth] ลบสาขาแล้ว หน้าที่เปิดค้างอยู่ต้องเด้งออกจากระบบ", async ({ page, request }) => {
  const errs = watchErrors(page);

  const created = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
    headers: { authorization: `Bearer ${await adminToken()}` },
    data: { code: CODE, name: "ZZTMP สาขาทดสอบเด้งออก", province: "ระยอง", region: "ตะวันออก", revenueTarget: 1_000_000 },
  });
  expect(created.status(), `สร้างสาขาต้องผ่าน (ได้ ${created.status()} · ${await created.text()})`).toBe(200);
  const cred = await created.json() as { email: string; password: string };

  await loginUI(page, DEALER_ORIGIN, "/login", cred);
  expect(new URL(page.url()).pathname, "ล็อกอินแล้วต้องเข้าถึงหน้าในระบบได้ก่อน").not.toContain("/login");

  // สำนักงานใหญ่ลบสาขาทิ้ง (route ลบบัญชีเข้าระบบให้ด้วย)
  const del = await request.delete(`${HQ_ORIGIN}/api/admin/dealers?code=${CODE}`, {
    headers: { authorization: `Bearer ${await adminToken()}` },
  });
  expect(del.status(), `ลบสาขาต้องผ่าน (ได้ ${del.status()} · ${await del.text()})`).toBe(200);

  // เบราว์เซอร์ที่ยังถือใบผ่านใบเดิม — เปิดหน้าในระบบต้องถูกเด้งออก ไม่ใช่เข้าไปเจอหน้าจอเปล่า
  await page.goto(`${DEALER_ORIGIN}/settings`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname,
    { timeout: 20_000, message: "สาขาถูกลบแล้ว ต้องเด้งไปหน้าเข้าสู่ระบบ" }).toContain("/login");

  // เหลือ error เดียวที่ "ต้องมี" ตามธรรมชาติของสถานการณ์: คำสั่งออกจากระบบถูกเซิร์ฟเวอร์ตอบ 403
  // เพราะบัญชีถูกลบไปแล้วจริง ๆ (ล้างใบผ่านในเครื่องสำเร็จ ผู้ใช้ถูกเด้งออกตามปกติ)
  assertNoErrors(errs.filter(e => !/auth\/v1\/logout/.test(e) && !/status of 403/.test(e)), "ลบสาขาแล้วเด้งออก");
});

test("[auth] สาขาที่ยังอยู่ต้องใช้งานได้ตามปกติ (ไม่เด้งออกผิดคน)", async ({ page }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname, "สาขาปกติต้องไม่ถูกเด้งออก").not.toContain("/login");
  await expect(page.getByText("บัญชีดีลเลอร์").first()).toBeVisible({ timeout: 15_000 });
});
