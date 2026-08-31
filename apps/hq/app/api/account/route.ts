// ── ตัวแทนแก้อีเมล/รหัสผ่านเข้าระบบของตัวเอง (บอสสั่ง 28 ส.ค. 69) ─────────────────
//
// ทำไม route นี้อยู่ที่แอปสำนักงานใหญ่ ทั้งที่คนใช้คือตัวแทน:
//   คีย์ผู้ดูแล (service role) และกุญแจถอดรหัสสำเนารหัสผ่าน (DEALER_SECRET_KEY) อยู่ที่นี่ที่เดียว
//   ถ้าให้แอปตัวแทนเปลี่ยนบัญชีเองตรง ๆ สำนักงานใหญ่จะเปิดดูรหัสที่ตัวแทนตั้งไม่ได้เลย
//   (แอปตัวแทนยิงข้ามมาที่นี่พร้อมใบผ่านของตัวเอง — ดู accountRemote.ts)
//
// ด่านป้องกัน:
//   1) ต้องมีใบผ่านที่ใช้ได้ และเป็นบัญชี "ของสาขานั้นจริง" (เทียบ profiles.dealer_code)
//      — ห้ามเชื่อรหัสสาขาที่ส่งมากับคำขอ
//   2) ต้องกรอกรหัสผ่านปัจจุบันถูกต้อง (ยืนยันด้วยการล็อกอินซ้ำ) — กันคนที่มานั่งหน้าจอที่เปิดค้าง
//   3) จำกัดความถี่ · บันทึก audit ทุกครั้ง (สำนักงานใหญ่ต้องรู้ว่าใครเปลี่ยนอะไรเมื่อไหร่)
//   4) แก้เองได้ 2 ครั้งตลอดอายุบัญชี — ครั้งที่ 3 ขึ้นไปกลายเป็น "คำขอ" ที่ยังไม่มีผล

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import { auditLog, withErrors } from "@pms/shared/lib/adminRoute";
import { encryptSecret, decryptSecret, dealerSecretReady } from "@pms/shared/lib/dealerSecret";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
/** จำนวนครั้งที่ตัวแทนแก้เองได้ตลอดอายุบัญชี — ต้องตรงกับฝั่งหน้าจอ (accountLocal.SELF_CHANGE_LIMIT) */
const SELF_LIMIT = 2;

/** แอปตัวแทนอยู่คนละที่อยู่กับแอปนี้ → ต้องอนุญาตข้ามต้นทางให้เฉพาะที่อยู่ที่เราตั้งไว้เท่านั้น */
function corsHeaders(req: NextRequest): Record<string, string> {
  const allow = (process.env.DEALER_APP_ORIGIN ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const ok = allow.includes(origin);
  return {
    ...(ok ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
  };
}
const json = (req: NextRequest, body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: corsHeaders(req) });

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

type ผู้เรียก = { admin: SupabaseClient; userId: string; email: string; dealerCode: string; name: string };

/** ตรวจใบผ่าน → คืนบัญชี "ของสาขา" ที่เรียกมา · ไม่ใช่ตัวแทน = ปฏิเสธ */
async function ตัวแทนที่เรียก(req: NextRequest): Promise<{ ok: true; who: ผู้เรียก } | { ok: false; res: NextResponse }> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, res: json(req, { error: "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ — เปลี่ยนบัญชีเข้าระบบยังไม่ได้" }, 501) };
  }
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, res: json(req, { error: "unauthorized" }, 401) };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error } = await admin.auth.getUser(token);
  if (error || !caller.user) return { ok: false, res: json(req, { error: "unauthorized" }, 401) };

  const { data: prof, error: profErr } = await admin
    .from("profiles").select("dealer_code, name, status").eq("id", caller.user.id).maybeSingle();
  if (profErr) {
    console.error("[account] อ่านโปรไฟล์ผู้เรียกไม่สำเร็จ", profErr);
    return { ok: false, res: json(req, { error: "ตรวจสอบสิทธิ์ไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง" }, 503) };
  }
  if (!prof || String(prof.status ?? "active") !== "active") {
    return { ok: false, res: json(req, { error: "บัญชีนี้ถูกปิดการใช้งานแล้ว — ติดต่อผู้ดูแลระบบ" }, 403) };
  }
  const dealerCode = String(prof.dealer_code ?? "").trim().toUpperCase();
  if (!dealerCode) {
    return { ok: false, res: json(req, { error: "บัญชีนี้ไม่ได้สังกัดสาขา — เปลี่ยนจากหน้านี้ไม่ได้" }, 403) };
  }
  return { ok: true, who: { admin, userId: caller.user.id, email: caller.user.email ?? "", dealerCode, name: String(prof.name ?? "") } };
}

/** ยืนยันรหัสผ่านปัจจุบันด้วยการล็อกอินซ้ำ (ไม่เก็บ session) */
async function รหัสปัจจุบันถูกไหม(email: string, password: string): Promise<boolean> {
  if (!ANON_KEY) return false;
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return !error && !!data.session;
}

/** ยังไม่ได้ติดตั้งตาราง = ตอบให้รู้ว่าต้องรัน migration ไม่ใช่ปล่อยให้เห็น error ดิบของฐานข้อมูล */
// (ไม่ export — ไฟล์ route ของ Next อนุญาตให้ export เฉพาะ handler/ค่าตั้งค่าเท่านั้น)
class ยังไม่ได้ติดตั้ง extends Error {}

async function สรุปสถานะ(admin: SupabaseClient, dealerCode: string, email: string) {
  const [changes, pendingRes] = await Promise.all([
    admin.from("dealer_account_changes")
      .select("id", { count: "exact", head: true }).eq("dealer_code", dealerCode).eq("by_self", true),
    admin.from("dealer_account_requests")
      .select("id, dealer_code, kind, new_email, status, requested_at")
      .eq("dealer_code", dealerCode).eq("status", "pending").maybeSingle(),
  ]);
  // ⚠️ ต้อง "ล้มแบบปิดประตู" เมื่อยืนยันโควตาไม่ได้ — ไม่ใช่ปล่อยผ่านเป็น 0 ครั้ง
  //    ยังไม่ได้ติดตั้งตาราง PostgREST คืน count = null โดยไม่มี error (ไม่ใช่ 42P01 เสมอไป)
  //    ถ้าถือว่า "ใช้ไป 0 ครั้ง" ตัวแทนจะแก้บัญชีได้ไม่จำกัด และไม่มีบันทึกให้สำนักงานใหญ่เห็นเลย
  const ขาดตาราง = changes.count === null
    || [changes.error, pendingRes.error].some(e => e && (e.code === "42P01" || /does not exist|schema cache/i.test(e.message ?? "")));
  if (ขาดตาราง) throw new ยังไม่ได้ติดตั้ง("ยังไม่ได้ติดตั้งตารางบัญชีตัวแทนในฐานข้อมูล (migration 0165) — รัน npx supabase db push ก่อน");
  const { count } = changes;
  const pending = pendingRes.data;
  return {
    email,
    selfChangesUsed: count ?? 0,
    selfChangesLimit: SELF_LIMIT,
    pending: pending ? {
      id: String(pending.id), dealerCode, kind: pending.kind,
      newEmail: pending.new_email ?? undefined, status: "pending" as const,
      requestedAt: String(pending.requested_at),
    } : null,
  };
}

// ── สถานะบัญชีของสาขาที่ล็อกอินอยู่ (อีเมล · โควตาที่เหลือ · คำขอที่ค้าง)
//    ?reveal=1 = เปิดดู "รหัสล่าสุดที่ระบบบันทึกไว้" ของสาขาตัวเอง ──
export const GET = withErrors("dealer-account-state", async (req: NextRequest) => {
  const who = await ตัวแทนที่เรียก(req);
  if (!who.ok) return who.res;
  const { admin, dealerCode, email, name } = who.who;

  if (new URL(req.url).searchParams.get("reveal") === "1") {
    // เปิดดูรหัสของตัวเอง — จำกัดความถี่และบันทึกร่องรอยเหมือนตอนสำนักงานใหญ่เปิดดู
    if (!(await checkRateLimit(admin, `dealer-account-reveal:${who.who.userId}`, 10, 60))) {
      return json(req, { error: "เปิดดูรหัสถี่เกินไป — รอสักครู่แล้วลองใหม่" }, 429);
    }
    if (!dealerSecretReady()) {
      return json(req, { password: null, note: "เซิร์ฟเวอร์ยังไม่ได้ตั้งกุญแจถอดรหัส — เปิดดูรหัสที่บันทึกไว้ไม่ได้" });
    }
    const { data, error } = await admin.from("dealer_login_secrets")
      .select("secret, updated_at").eq("dealer_code", dealerCode).maybeSingle();
    if (error) {
      console.error(`[account] อ่านสำเนารหัสของ ${dealerCode} ไม่สำเร็จ`, error);
      return json(req, { error: "อ่านรหัสที่บันทึกไว้ไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง" }, 503);
    }
    if (!data) {
      // ไม่ใช่ข้อผิดพลาด — แค่ยังไม่มีสำเนา (รหัสถูกตั้งไว้ก่อนเปิดฟีเจอร์เก็บสำเนา)
      return json(req, { password: null, note: "ยังไม่มีรหัสที่ระบบบันทึกไว้ — เปลี่ยนรหัสหนึ่งครั้งแล้วจะเห็นที่นี่" });
    }
    await auditLog(admin, { name, role: "DEALER" }, "ตัวแทนเปิดดูรหัสผ่านของตัวเอง", dealerCode);
    return json(req, {
      password: decryptSecret(String(data.secret)),
      updatedAt: String(data.updated_at ?? ""),
      note: "รหัสล่าสุดที่ระบบบันทึกไว้ — ถ้าเปลี่ยนรหัสจากช่องทางอื่น ค่านี้อาจไม่ตรงกับที่ใช้อยู่",
    });
  }
  try {
    return json(req, await สรุปสถานะ(admin, dealerCode, email));
  } catch (e) {
    if (e instanceof ยังไม่ได้ติดตั้ง) return json(req, { error: e.message }, 501);
    throw e;
  }
});

// ── ขอเปลี่ยนอีเมล/รหัสผ่านของตัวเอง ──
export const POST = withErrors("dealer-account-change", async (req: NextRequest) => {
  const who = await ตัวแทนที่เรียก(req);
  if (!who.ok) return who.res;
  const { admin, userId, email: อีเมลเดิม, dealerCode, name } = who.who;

  if (!(await checkRateLimit(admin, `dealer-account-change:${userId}`, 5, 300))) {
    return json(req, { error: "เปลี่ยนบัญชีถี่เกินไป — รอสักครู่แล้วลองใหม่" }, 429);
  }

  const body = (await req.json().catch(() => null)) as null | { email?: string; password?: string; currentPassword?: string };
  const อีเมลใหม่ = String(body?.email ?? "").trim().toLowerCase();
  const รหัสใหม่ = String(body?.password ?? "");
  const รหัสเดิม = String(body?.currentPassword ?? "");
  if (!อีเมลใหม่ && !รหัสใหม่) return json(req, { error: "ยังไม่ได้กรอกอีเมลหรือรหัสผ่านใหม่" }, 400);
  if (อีเมลใหม่ && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(อีเมลใหม่)) return json(req, { error: "รูปแบบอีเมลไม่ถูกต้อง" }, 400);
  if (รหัสใหม่ && รหัสใหม่.length < 8) return json(req, { error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" }, 400);
  if (!รหัสเดิม) return json(req, { error: "ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน" }, 400);
  if (!(await รหัสปัจจุบันถูกไหม(อีเมลเดิม, รหัสเดิม))) {
    return json(req, { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, 400);
  }

  const kind = อีเมลใหม่ && รหัสใหม่ ? "both" : (อีเมลใหม่ ? "email" : "password");
  let สถานะ;
  try {
    สถานะ = await สรุปสถานะ(admin, dealerCode, อีเมลเดิม);
  } catch (e) {
    if (e instanceof ยังไม่ได้ติดตั้ง) return json(req, { error: e.message }, 501);
    throw e;
  }
  if (สถานะ.pending) {
    return json(req, { error: "มีคำขอที่รอสำนักงานใหญ่อนุมัติอยู่แล้ว — รอผลก่อนส่งคำขอใหม่" }, 409);
  }

  // ── เกินโควตา → เก็บเป็นคำขอ ยังไม่แตะบัญชีจริง ──
  if (สถานะ.selfChangesUsed >= SELF_LIMIT) {
    if (รหัสใหม่ && !dealerSecretReady()) {
      return json(req, { error: "เซิร์ฟเวอร์ยังไม่พร้อมรับคำขอเปลี่ยนรหัสผ่าน — ติดต่อผู้ดูแลระบบ" }, 501);
    }
    const { error } = await admin.from("dealer_account_requests").insert({
      dealer_code: dealerCode, kind,
      new_email: อีเมลใหม่ || null,
      secret: รหัสใหม่ ? encryptSecret(รหัสใหม่) : null,
    });
    if (error) {
      console.error(`[account] เปิดคำขอของสาขา ${dealerCode} ไม่สำเร็จ`, error);
      return json(req, { error: "ส่งคำขอไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง" }, 503);
    }
    await auditLog(admin, { name, role: "DEALER" }, "ตัวแทนขอเปลี่ยนบัญชีเข้าระบบ", `${dealerCode}${อีเมลใหม่ ? ` · ${อีเมลใหม่}` : ""}`);
    return json(req, {
      applied: false, pending: true,
      message: "ใช้สิทธิ์แก้เองครบแล้ว — ส่งคำขอให้สำนักงานใหญ่อนุมัติแล้ว การเปลี่ยนจะมีผลเมื่อได้รับอนุมัติ",
    });
  }

  // ── ยังมีโควตา → เปลี่ยนให้ทันที ──
  const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
    ...(รหัสใหม่ ? { password: รหัสใหม่ } : {}),
    ...(อีเมลใหม่ ? { email: อีเมลใหม่, email_confirm: true } : {}),
  });
  if (upErr) {
    if (/already|registered|exists/i.test(upErr.message ?? "")) {
      return json(req, { error: `อีเมล ${อีเมลใหม่} ถูกใช้ไปแล้วในระบบ` }, 400);
    }
    console.error(`[account] เปลี่ยนบัญชีของสาขา ${dealerCode} ไม่สำเร็จ`, upErr);
    return json(req, { error: "เปลี่ยนบัญชีไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง" }, 503);
  }

  // เก็บสำเนารหัสให้สำนักงานใหญ่เปิดดูได้ (ที่เดียวกับรหัสที่ HQ ตั้งให้)
  if (รหัสใหม่ && dealerSecretReady()) {
    const secret = encryptSecret(รหัสใหม่);
    if (secret) {
      const { error } = await admin.from("dealer_login_secrets")
        .upsert({ dealer_code: dealerCode, secret, updated_at: new Date().toISOString(), updated_by: `${name} (ตัวแทนตั้งเอง)` });
      if (error) console.error(`[account] เก็บสำเนารหัสของ ${dealerCode} ไม่สำเร็จ`, error);
    }
  }
  const { error: logErr } = await admin.from("dealer_account_changes").insert({
    dealer_code: dealerCode, kind, old_email: อีเมลเดิม, new_email: อีเมลใหม่ || null, by_self: true,
  });
  if (logErr) console.error(`[account] บันทึกการเปลี่ยนของ ${dealerCode} ไม่สำเร็จ`, logErr);

  await auditLog(admin, { name, role: "DEALER" },
    kind === "email" ? "ตัวแทนเปลี่ยนอีเมลเข้าระบบเอง" : kind === "password" ? "ตัวแทนเปลี่ยนรหัสผ่านเอง" : "ตัวแทนเปลี่ยนอีเมลและรหัสผ่านเอง",
    `${dealerCode}${อีเมลใหม่ ? ` · ${อีเมลใหม่}` : ""}`);

  const เหลือ = Math.max(0, SELF_LIMIT - สถานะ.selfChangesUsed - 1);
  return json(req, {
    applied: true, pending: false,
    message: `เปลี่ยนเรียบร้อย — เหลือสิทธิ์แก้เองอีก ${เหลือ} ครั้ง · สำนักงานใหญ่จะเห็นการเปลี่ยนนี้`,
  });
});
