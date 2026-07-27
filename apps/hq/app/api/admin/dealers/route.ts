// ── H5 · สร้างตัวแทน "พร้อมบัญชีเข้าระบบจริง" (ต้องใช้ service_role) ────────────────
//
// ทำไมต้องเป็น Route Handler ฝั่งเซิร์ฟเวอร์:
//   การสร้างบัญชีใน auth.users ต้องใช้ service_role ซึ่ง "ห้ามอยู่ในเบราว์เซอร์เด็ดขาด"
//   (ใครถือคีย์นี้ข้าม RLS ได้ทั้งระบบ) — จึงทำได้เฉพาะที่นี่ ที่รันบนเซิร์ฟเวอร์เท่านั้น
//
// เดิม (บั๊ก H5): หน้า /hq/dealers สร้างเฉพาะแถวใน dealers + โชว์รหัสให้ก๊อป
//   แต่ไม่มีบัญชี auth ผูกอยู่ → ตัวแทนใหม่ล็อกอินไม่ได้เลย · รหัสที่โชว์ไม่มีความหมายกับระบบใด
//
// ความปลอดภัยของ handler นี้ (ไล่ตามลำดับ):
//   1) ตรวจ JWT ของ "ผู้เรียก" ที่เซิร์ฟเวอร์เอง แล้วดูบทบาทจาก profiles จริง
//      — ห้ามเชื่อว่า route ถูกเรียกจากหน้าจอที่ถูกต้อง (ใครยิงตรงก็ถึง)
//   2) service_role อ่านจาก env ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มี NEXT_PUBLIC_)
//   3) ล้มเหลวกลางทาง = ลบ auth user ที่เพิ่งสร้างทิ้ง ไม่ให้เหลือบัญชีกำพร้า
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// รันบน Node เสมอ (ต้องใช้ service_role — ห้าม edge ที่อาจแคช env แปลก ๆ)
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// บทบาทที่มีสิทธิ์จัดการตัวแทน = ตรงกับ dealers:manage ใน permissions.ts (can_write_master)
const CAN_MANAGE_DEALERS = new Set(["SUPER_ADMIN", "HQ_MANAGEMENT"]);
const DEALER_EMAIL_DOMAIN = "partner-agent.co.th";

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// รหัสผ่านตั้งต้นที่แข็งแรง — ออกที่เซิร์ฟเวอร์ ไม่ให้ client กำหนด (กันรหัสอ่อน/เดาได้)
// ตัวแทนต้องเปลี่ยนเองหลังเข้าครั้งแรก
function strongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];
  // ให้มีครบทุกชนิดอย่างน้อยอย่างละตัว แล้วเติมที่เหลือ
  let out = pick(upper, 0) + pick(lower, 1) + pick(digit, 2);
  for (let i = 3; i < 14; i++) out += pick(all, i);
  return "PEB-" + out;
}

async function must(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

export async function POST(req: NextRequest) {
  // ── 0) ต้องตั้งค่า service_role ก่อน — ไม่งั้นบอกตรง ๆ ไม่แกล้งทำสำเร็จ ──
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad(501, "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — สร้างบัญชีตัวแทนจากที่นี่ยังไม่ได้");
  }

  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1) ยืนยันตัวตน + สิทธิ์ของ "ผู้เรียก" ที่เซิร์ฟเวอร์ ──
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return bad(401, "unauthorized");
  const { data: caller, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !caller.user) return bad(401, "unauthorized");
  const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (!prof || !CAN_MANAGE_DEALERS.has(String(prof.role))) return bad(403, "ไม่มีสิทธิ์จัดการตัวแทน");

  // ── 2) ตรวจ payload ──
  const body = (await req.json().catch(() => null)) as null | {
    code?: string; name?: string; province?: string; region?: string; revenueTarget?: number;
  };
  if (!body) return bad(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const province = String(body.province ?? "").trim();
  const region = String(body.region ?? "").trim();
  const revenueTarget = Number(body.revenueTarget ?? 0);
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนต้องเป็นตัวอักษร A–Z 2–5 ตัว");
  if (!name || !province) return bad(400, "ต้องระบุชื่อและจังหวัด");

  // สาขาซ้ำ = ปฏิเสธก่อนแตะ auth (กันสร้าง auth user ทิ้งฟรี)
  const { data: dupe } = await admin.from("dealers").select("code").eq("code", code).maybeSingle();
  if (dupe) return bad(409, `รหัส "${code}" มีอยู่แล้ว`);

  const email = `${code.toLowerCase()}@${DEALER_EMAIL_DOMAIN}`;
  const password = strongPassword();

  // ── 3) สร้างบัญชี auth (ยืนยันอีเมลให้เลย เพราะเป็นบัญชีที่ HQ ออกให้) ──
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !createdUser.user) {
    const msg = createErr?.message ?? "สร้างบัญชีเข้าระบบไม่สำเร็จ";
    // อีเมลชนกับบัญชีเดิม = โดยมากรหัสสาขาถูกใช้ไปแล้วในระบบยืนยันตัวตน
    return bad(400, /already/i.test(msg) ? `อีเมล ${email} ถูกใช้ไปแล้วในระบบยืนยันตัวตน` : msg);
  }
  const uid = createdUser.user.id;

  // ── 4) ทะเบียนสาขา + โปรไฟล์ (ผูกกับบัญชีที่เพิ่งสร้าง) · ล้มเหลว = ย้อน auth user ──
  try {
    await must(admin.from("dealers").insert({
      code, name, province, region, revenue_target: revenueTarget, status: "active",
    }));
    // profiles.id → auth.users(id) · บทบาทตั้งต้นของหัวสาขา = DEALER_ADMIN
    await must(admin.from("profiles").upsert({
      id: uid, role: "DEALER_ADMIN", dealer_code: code, name, status: "active",
    }, { onConflict: "id" }));
  } catch (e) {
    // ย้อนทุกอย่างที่อาจสร้างไปแล้ว ไม่ให้เหลือบัญชี/แถวกำพร้า (เงียบไว้ — เรากำลังรายงาน error ตัวจริงอยู่แล้ว)
    try { await admin.auth.admin.deleteUser(uid); } catch { /* best-effort */ }
    try { await admin.from("dealers").delete().eq("code", code); } catch { /* best-effort */ }
    return bad(400, `สร้างทะเบียน/โปรไฟล์ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
  }

  // คืนรหัสให้หน้าจอโชว์ให้ก๊อปไปแจ้งตัวแทน (แจ้งครั้งเดียว — ไม่เก็บไว้ที่ไหน)
  return NextResponse.json({ ok: true, email, password });
}

// ── ลบตัวแทน "พร้อมบัญชีเข้าระบบ" (hard delete) ────────────────────────────────────
// เดิม: ลบตัวแทนทำได้แค่ลบแถว dealers (ผ่าน RLS) → บัญชี auth ของสาขายังค้าง = บัญชีกำพร้า
//   (ล็อกอินได้แต่ไม่มีสาขา · และรหัสสาขาเดิมกลับมาสร้างซ้ำไม่ได้เพราะอีเมลชนบัญชีเก่า)
// ที่นี่ลบให้ครบ: auth user ของผู้ใช้สังกัดสาขานี้ (profile หายตาม FK cascade) + แถว dealers
export async function DELETE(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad(501, "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — ลบตัวแทนจากที่นี่ยังไม่ได้");
  }
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ยืนยันตัวตน + สิทธิ์ของผู้เรียกที่เซิร์ฟเวอร์ (เหมือน POST — ห้ามเชื่อหน้าจอ)
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return bad(401, "unauthorized");
  const { data: caller, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !caller.user) return bad(401, "unauthorized");
  const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (!prof || !CAN_MANAGE_DEALERS.has(String(prof.role))) return bad(403, "ไม่มีสิทธิ์จัดการตัวแทน");

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนไม่ถูกต้อง");

  // ── กันทำลายครึ่งทาง ──
  // dealer FK เป็น on delete restrict (0018) — ถ้าสาขายังมีข้อมูลงานขาย แถว dealers ลบไม่ได้
  // เดิมลบ auth users "ก่อน" แล้วค่อยลบแถว → พอแถวลบไม่ได้ = บัญชี login หายไปแล้วแต่สาขายังอยู่
  // (สาขากำพร้าไม่มีคนเข้าได้ · ย้อนไม่ได้) → ต้องเช็ก + ลบแถวให้สำเร็จ "ก่อน" แตะ auth
  for (const t of ["leads", "quotations", "customers", "appointments", "files"]) {
    const { count } = await admin.from(t).select("dealer_code", { count: "exact", head: true }).eq("dealer_code", code);
    if ((count ?? 0) > 0) {
      return bad(409, `สาขา "${code}" ยังมีข้อมูล (${t}) — ต้องย้าย/ลบข้อมูลก่อนจึงจะลบสาขาได้`);
    }
  }
  // ค่าตั้งของสาขาเอง (FK restrict เช่นกัน) — ลบก่อนแถว dealers
  await admin.from("responsible_persons").delete().eq("dealer_code", code);
  await admin.from("dealer_lead_rules").delete().eq("dealer_code", code);
  // ลบแถว dealers ก่อน — จุดที่อาจ fail · สำเร็จแล้วค่อยแตะ auth ที่ย้อนไม่ได้
  const { error } = await admin.from("dealers").delete().eq("code", code);
  if (error) return bad(400, `ลบตัวแทนไม่สำเร็จ: ${error.message}`);
  // ลบบัญชี auth ของผู้ใช้สังกัดสาขา (profile หายตาม cascade) — ทำท้ายสุด
  const { data: members } = await admin.from("profiles").select("id").eq("dealer_code", code);
  for (const m of members ?? []) {
    try { await admin.auth.admin.deleteUser(String(m.id)); } catch { /* best-effort — ลบให้ครบเท่าที่ได้ */ }
  }
  return NextResponse.json({ ok: true });
}
