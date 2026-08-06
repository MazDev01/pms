// ── เปิดดูรหัสผ่านของตัวแทน (HQ เท่านั้น) ──────────────────────────────────────
//
// ทำไมต้องเป็น route แยก ไม่ส่งมากับข้อมูลตัวแทนตั้งแต่แรก:
//   รหัสผ่านต้องไม่ถูกส่งไปหน้าเว็บโดยที่ผู้ใช้ไม่ได้ตั้งใจกดดู — ครั้งก่อนรหัสถูกฝังใน mock.ts
//   แล้วติดไปกับไฟล์ที่เบราว์เซอร์โหลดทุกหน้า รวมหน้าล็อกอินที่ยังไม่ต้องเข้าระบบ
//   (Critical จากผลตรวจสอบระบบรอบ 2) · ที่นี่จึงเป็น "ดึงตอนกด" ทีละสาขาเท่านั้น
//
// ด่านป้องกัน 4 ชั้น:
//   1) ต้องมีสิทธิ์ dealers:manage (SUPER_ADMIN / HQ_MANAGEMENT) — HQ_STAFF และตัวแทนเข้าไม่ได้
//   2) ตาราง dealer_login_secrets ไม่มี RLS policy เลย → อ่านได้ทางเดียวคือ service_role ที่นี่
//   3) ค่าที่เก็บเข้ารหัสไว้ ต้องมี DEALER_SECRET_KEY ถึงจะถอดได้
//   4) บันทึก audit ทุกครั้งที่เปิดดู — ใครดูของสาขาไหน เมื่อไหร่
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import { bad, authorizeAdmin, auditLog, withErrors } from "@pms/shared/lib/adminRoute";
import { decryptSecret, dealerSecretReady } from "@pms/shared/lib/dealerSecret";

export const runtime = "nodejs";

export const GET = withErrors("view-dealer-secret", async (req: NextRequest) => {
  const authz = await authorizeAdmin(
    req, "dealers:manage", "ไม่มีสิทธิ์ดูรหัสผ่านตัวแทน",
    "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — ดูรหัสผ่านตัวแทนจากที่นี่ยังไม่ได้",
  );
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  // การเปิดดูรหัสเป็นการเข้าถึงของอ่อนไหว — จำกัดถี่เท่ากับการขอเข้าระบบแทน
  if (!(await checkRateLimit(admin, `view-dealer-secret:${callerId}`, 10, 60))) {
    return bad(429, "เปิดดูรหัสผ่านถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนไม่ถูกต้อง");

  if (!dealerSecretReady()) {
    return bad(501, "ยังไม่ได้ตั้งค่า DEALER_SECRET_KEY ที่เซิร์ฟเวอร์ — เปิดดูรหัสผ่านย้อนหลังไม่ได้");
  }

  const { data, error } = await admin.from("dealer_login_secrets")
    .select("secret, updated_at, updated_by").eq("dealer_code", code).maybeSingle();
  if (error) {
    console.error(`[view-dealer-secret] อ่านสำเนารหัสของ ${code} ไม่สำเร็จ`, error);
    return bad(503, "อ่านรหัสผ่านไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }
  if (!data) {
    // ไม่ใช่ error — แค่ยังไม่เคยตั้ง/รีเซ็ตรหัสผ่านหลังเปิดฟีเจอร์นี้
    return bad(404, `ยังไม่มีรหัสผ่านที่บันทึกไว้ของสาขา "${code}" — กด "รีเซ็ตรหัสผ่าน" เพื่อออกรหัสใหม่`);
  }

  const password = decryptSecret(String(data.secret));
  if (!password) {
    console.error(`[view-dealer-secret] ถอดรหัสของ ${code} ไม่สำเร็จ — กุญแจอาจไม่ตรงกับตอนที่บันทึก`);
    return bad(500, "ถอดรหัสไม่สำเร็จ — กุญแจเข้ารหัสอาจถูกเปลี่ยน กรุณารีเซ็ตรหัสผ่านใหม่");
  }

  // บันทึกก่อนคืนค่า — การเปิดดูต้องมีร่องรอยเสมอ แม้ผู้ดูจะเป็นผู้มีสิทธิ์
  await auditLog(admin, prof, "เปิดดูรหัสผ่านตัวแทน", code);

  return NextResponse.json(
    { ok: true, password, updatedAt: data.updated_at, updatedBy: data.updated_by },
    { headers: { "Cache-Control": "no-store, private" } },
  );
});
