// ── สร้าง/ลบ "ผู้ใช้สำนักงานใหญ่ (HQ)" พร้อมบัญชีเข้าระบบจริง (ต้องใช้ service_role) ──
//
// ทำไมต้องเป็น Route Handler ฝั่งเซิร์ฟเวอร์ (เหมือน /api/admin/dealers · H5):
//   สร้าง/ลบบัญชีใน auth.users ต้องใช้ service_role ซึ่ง "ห้ามอยู่ในเบราว์เซอร์เด็ดขาด"
//   (ใครถือคีย์นี้ข้าม RLS ได้ทั้งระบบ) — จึงทำได้เฉพาะที่นี่ ที่รันบนเซิร์ฟเวอร์เท่านั้น
//
// เดิม (บั๊ก): หน้า /hq/users กด "เพิ่มผู้ใช้ HQ" แล้วแค่เพิ่มแถวในหน่วยความจำ (id = Date.now())
//   ไม่มีบัญชี auth ผูกอยู่ → ผู้ใช้ใหม่ล็อกอินไม่ได้เลย · และลบไม่ได้จริง (มีแต่ปิดใช้งาน)
//
// ความปลอดภัยของ handler นี้ (ไล่ตามลำดับ):
//   1) ตรวจ JWT ของ "ผู้เรียก" ที่เซิร์ฟเวอร์เอง แล้วดูบทบาทจาก profiles จริง (ห้ามเชื่อหน้าจอ)
//   2) service_role อ่านจาก env ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มี NEXT_PUBLIC_)
//   3) สร้างล้มเหลวกลางทาง = ลบ auth user ที่เพิ่งสร้างทิ้ง ไม่ให้เหลือบัญชีกำพร้า
//   4) ลบ = กันลบตัวเอง และกันลบ SUPER_ADMIN คนสุดท้าย (กันล็อกตัวเองออกจากระบบ)
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";

// รันบน Node เสมอ (ต้องใช้ service_role — ห้าม edge ที่อาจแคช env แปลก ๆ)
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// บทบาทที่มีสิทธิ์จัดการผู้ใช้ HQ — SUPER_ADMIN + HQ_MANAGEMENT (ตรงกับ dealers:manage)
const CAN_MANAGE_USERS = new Set(["SUPER_ADMIN", "HQ_MANAGEMENT"]);
// บทบาทที่อนุญาตให้ "ตั้ง" ให้ผู้ใช้ HQ (ฝั่งสำนักงานใหญ่เท่านั้น — ไม่ออกบัญชีตัวแทนจากที่นี่)
const HQ_ROLES = new Set(["SUPER_ADMIN", "HQ_MANAGEMENT", "HQ_STAFF"]);

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// รหัสผ่านตั้งต้นที่แข็งแรง — ออกที่เซิร์ฟเวอร์ ไม่ให้ client กำหนด (กันรหัสอ่อน/เดาได้)
// ผู้ใช้ต้องเปลี่ยนเองหลังเข้าครั้งแรก
function strongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];
  let out = pick(upper, 0) + pick(lower, 1) + pick(digit, 2);
  for (let i = 3; i < 14; i++) out += pick(all, i);
  return "BJ-" + out;
}

async function must(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

// ตรวจ service_role + ยืนยันตัวตน/สิทธิ์ของผู้เรียก — คืน client(admin) กับ id ผู้เรียก หรือ Response error
// บันทึก audit ฝั่งเซิร์ฟเวอร์แบบ "การันตี" — สร้าง/ลบผู้ใช้ HQ ต้องมีร่องรอยเสมอ
// (เดิมพึ่ง client useAuditLogger หลัง route คืน · fire-and-forget · ล้มเหลว=ไม่มีบันทึก)
// service_role ข้าม RLS insert ได้ · best-effort: audit ล้มต้องไม่ทำให้งานหลักพัง
async function audit(admin: SupabaseClient, prof: { role?: string; name?: string } | null, action: string, target: string) {
  try {
    await admin.from("audit_log").insert({ user: prof?.name ?? "", role: prof?.role ?? "", action, target });
  } catch { /* best-effort */ }
}

async function authorize(req: NextRequest): Promise<
  | { ok: true; admin: SupabaseClient; callerId: string; prof: { role?: string; name?: string } }
  | { ok: false; res: NextResponse }
> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, res: bad(501, "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — จัดการผู้ใช้ HQ จากที่นี่ยังไม่ได้") };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, res: bad(401, "unauthorized") };
  const { data: caller, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !caller.user) return { ok: false, res: bad(401, "unauthorized") };
  const { data: prof } = await admin.from("profiles").select("role, name").eq("id", caller.user.id).maybeSingle();
  if (!prof || !CAN_MANAGE_USERS.has(String(prof.role))) {
    return { ok: false, res: bad(403, "ไม่มีสิทธิ์จัดการผู้ใช้สำนักงานใหญ่") };
  }
  return { ok: true, admin, callerId: caller.user.id, prof };
}

// ── สร้างผู้ใช้ HQ + บัญชีเข้าระบบจริง ──
export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;
  const { admin, prof } = auth;

  // กันยิงรัว: สร้างผู้ใช้ HQ ได้ไม่เกิน 10 ครั้ง/นาที ต่อผู้เรียก (distributed ผ่าน DB · ดู rateLimit.ts)
  if (!(await checkRateLimit(admin, `create-user:${auth.callerId}`, 10, 60))) {
    return bad(429, "สร้างผู้ใช้ถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const body = (await req.json().catch(() => null)) as null | {
    name?: string; email?: string; phone?: string; role?: string; department?: string;
    status?: string; avatar?: string;
  };
  if (!body) return bad(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const role = String(body.role ?? "").trim();
  const department = String(body.department ?? "").trim();
  const status = body.status === "inactive" ? "inactive" : "active";
  const avatar = typeof body.avatar === "string" ? body.avatar : "";
  if (!name) return bad(400, "ต้องระบุชื่อ");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(400, "อีเมลไม่ถูกต้อง");
  if (!HQ_ROLES.has(role)) return bad(400, "บทบาทไม่ถูกต้อง (ต้องเป็นผู้ใช้สำนักงานใหญ่)");

  const password = strongPassword();

  // สร้างบัญชี auth (ยืนยันอีเมลให้เลย เพราะเป็นบัญชีที่ HQ ออกให้)
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !createdUser.user) {
    const msg = createErr?.message ?? "สร้างบัญชีเข้าระบบไม่สำเร็จ";
    return bad(400, /already/i.test(msg) ? `อีเมล ${email} ถูกใช้ไปแล้วในระบบยืนยันตัวตน` : msg);
  }
  const uid = createdUser.user.id;

  // โปรไฟล์ผูกกับบัญชีที่เพิ่งสร้าง · dealer_code ว่าง = ผู้ใช้สำนักงานใหญ่ · contact_email = อีเมลล็อกอิน
  try {
    await must(admin.from("profiles").upsert({
      id: uid, role, dealer_code: "", name, department, phone, contact_email: email, status, avatar,
    }, { onConflict: "id" }));
  } catch (e) {
    // ย้อน auth user ที่เพิ่งสร้าง ไม่ให้เหลือบัญชีกำพร้า (เงียบไว้ — กำลังรายงาน error ตัวจริง)
    try { await admin.auth.admin.deleteUser(uid); } catch { /* best-effort */ }
    return bad(400, `สร้างโปรไฟล์ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
  }

  // คืนรหัสให้หน้าจอโชว์ครั้งเดียว (แจ้งครั้งเดียว — ไม่เก็บไว้ที่ไหน)
  await audit(admin, prof, "เพิ่มผู้ใช้ HQ", email);
  return NextResponse.json({ ok: true, id: uid, email, password });
}

// ── ลบผู้ใช้ HQ (hard delete) — ลบ auth.users แล้ว profile หายตาม (FK on delete cascade) ──
export async function DELETE(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.res;
  const { admin, callerId, prof } = auth;

  const id = (new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return bad(400, "ไม่ได้ระบุผู้ใช้ที่จะลบ");
  if (id === callerId) return bad(400, "ลบบัญชีของตัวเองไม่ได้");

  const { data: target } = await admin.from("profiles").select("role, dealer_code, name").eq("id", id).maybeSingle();
  if (!target) return bad(404, "ไม่พบผู้ใช้นี้");
  // route นี้จัดการเฉพาะผู้ใช้สำนักงานใหญ่ — บัญชีตัวแทนต้องจัดการที่หน้า /hq/dealers
  if (String(target.dealer_code ?? "")) return bad(400, "นี่เป็นบัญชีตัวแทน — จัดการที่หน้า “ตัวแทน”");

  // กันลบ SUPER_ADMIN คนสุดท้าย (ไม่งั้นระบบจะไม่มีผู้ดูแลสูงสุดเหลือเลย)
  if (String(target.role) === "SUPER_ADMIN") {
    const { count } = await admin.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "SUPER_ADMIN").eq("dealer_code", "");
    if ((count ?? 0) <= 1) return bad(400, "ลบผู้ดูแลระบบ (Super Admin) คนสุดท้ายไม่ได้");
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return bad(400, `ลบบัญชีไม่สำเร็จ: ${error.message}`);
  await audit(admin, prof, "ลบผู้ใช้ HQ", String(target.name ?? id));
  return NextResponse.json({ ok: true });
}
