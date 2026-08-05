// ── เข้าระบบแทนตัวแทน (impersonate) โดยไม่ต้องรู้/รีเซ็ตรหัสผ่านของตัวแทน ──────────
//
// เดิมเข้าใจว่าทำไม่ได้เพราะรหัสผ่านตัวแทนถูก hash ไว้ใน Supabase Auth — แต่ service_role
// ไม่จำเป็นต้อง "รู้" รหัสผ่านเพื่อสร้าง session ให้ผู้ใช้คนอื่น: Supabase Admin API มี
// generateLink(type: "magiclink") ที่ออก one-time token ยืนยันตัวตนแทนรหัสผ่านได้ตรง ๆ
// (กลไกเดียวกับ "ลืมรหัสผ่าน" — ต่างกันที่ HQ เป็นผู้ขอแทนตัวแทน ไม่ใช่ตัวแทนขอเอง)
//
// ลิงก์ที่ได้ใช้ครั้งเดียวแล้วหมดอายุ (Supabase บังคับ) — เปิดในแท็บใหม่ไปยังแอปตัวแทน
// (คนละ origin กับ HQ · session เก็บแบบ sessionStorage แยกต่อแท็บอยู่แล้ว — ดู supabase/client.ts)
// จึงไม่กระทบ session ของ HQ เองในแท็บปัจจุบันเลย
//
// ⚠️ ต้องตั้งค่าเพิ่มที่ Supabase Dashboard (ดู .env.example): เพิ่ม URL ของแอปตัวแทน
//    (NEXT_PUBLIC_DEALER_APP_URL) ลงใน Authentication → URL Configuration → Redirect URLs
//    ไม่งั้น generateLink จะสำเร็จแต่ redirect หลังคลิกลิงก์จะถูกปฏิเสธ
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import { bad, authorizeAdmin, auditLog, withErrors, findDealerAccount } from "@pms/shared/lib/adminRoute";

export const runtime = "nodejs";

const DEALER_APP_URL = process.env.NEXT_PUBLIC_DEALER_APP_URL ?? "http://localhost:3001";
const DEALER_EMAIL_DOMAIN = "partner-agent.co.th";

export const POST = withErrors("impersonate-dealer", async (req: NextRequest) => {
  const authz = await authorizeAdmin(
    req, "dealers:manage", "ไม่มีสิทธิ์จัดการตัวแทน",
    "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — เข้าระบบแทนตัวแทนจากที่นี่ยังไม่ได้",
  );
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  // เข้าระบบแทนคือการเข้าถึงบัญชีคนอื่นเต็มรูปแบบ — จำกัดถี่กว่าจุดอื่นเล็กน้อย
  if (!(await checkRateLimit(admin, `impersonate-dealer:${callerId}`, 10, 60))) {
    return bad(429, "ขอเข้าระบบแทนถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนไม่ถูกต้อง");

  // ต้องมีบัญชีของสาขานี้จริงและมีบัญชีเดียวเท่านั้น — ถ้าอ่านไม่ได้/เจอหลายบัญชี ต้องบอกให้ต่างกัน
  const found = await findDealerAccount(admin, code);
  if (!found.ok) return found.res;

  const email = `${code.toLowerCase()}@${DEALER_EMAIL_DOMAIN}`;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${DEALER_APP_URL}/dashboard?impersonated=1` },
  });
  if (linkErr || !link) return bad(400, `สร้างลิงก์เข้าระบบไม่สำเร็จ: ${linkErr?.message ?? ""}`);

  // บันทึกทันทีตอนออกลิงก์ (ไม่ใช่ตอนคลิก) — ลิงก์นี้ = สิทธิ์เข้าถึงเต็มรูปแบบ ต้องมีร่องรอยเสมอ
  await auditLog(admin, prof, "เข้าระบบแทนตัวแทน", code);
  return NextResponse.json({ ok: true, link: link.properties.action_link });
});
