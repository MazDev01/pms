"use client";

// ชั้น AUTH ฝั่ง Supabase (Phase 0) — เชื่อม Supabase Auth จริง
//   signInWithPassword · signOut · restore session · onAuthStateChange
// อ่าน dealer_code / user_role จาก JWT claims (ใส่โดย custom_access_token_hook ที่ DB)
// แล้วปั้นเป็น MockSession รูปเดียวกับโหมด local → RoleContext ใช้ร่วมกันได้ทั้งสองโหมด
import { getSupabase } from "./data/supabase/client";
import { DEMO_PASSWORD, type AuthResult } from "./auth";
import type { MockSession, UserRole } from "./mock";
import { HQ_ROLES } from "./permissions";

const isHQRole = (r: UserRole): boolean => HQ_ROLES.includes(r);

// อีเมลบัญชีเดโม (seed ไว้แล้ว) สำหรับปุ่มเข้าด่วนในหน้า login
const DEMO_EMAIL: Record<"hq" | "dealer", string> = {
  hq: "admin@benjamin.com",
  dealer: "cnx@dealer.com",
};

const ERR_GENERIC = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

// decode payload (ส่วนกลาง) ของ JWT แบบ base64url → UTF-8 ปลอดภัย (รองรับอักขระไทยใน claims)
function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    let json: string;
    if (typeof atob === "function") {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      json = new TextDecoder().decode(bytes);
    } else {
      json = Buffer.from(b64, "base64").toString("utf8");
    }
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// JWT (access_token) → MockSession · dealer_code ว่าง = HQ (เห็นทั้งเครือ)
function sessionFromToken(accessToken: string, email: string): MockSession {
  const c = decodeClaims(accessToken);
  const role = (typeof c.user_role === "string" ? c.user_role : "DEALER_ADMIN") as UserRole;
  const dealerCode = typeof c.dealer_code === "string" ? c.dealer_code : "";
  const hq = isHQRole(role) || dealerCode === "";
  return {
    name: email,                                    // ชื่อจริงเติมทีหลังจาก profiles.name
    role,
    dealerName: hq ? "Benjamin HQ" : dealerCode,    // ชื่อสาขาจริงเติมทีหลังจาก dealers.name
    dealerCode,
    scopeAll: hq,
  };
}

// JWT พก dealer_code/role มาให้ แต่ไม่มี "ชื่อ" — ต้องอ่านจากตารางเอง
// ไม่งั้นหน้าจอโชว์ "cnx@dealer.com" แทนชื่อคน และ "CNX" แทน "บจ. เชียงใหม่สตีลบิลด์"
// อ่านไม่ได้ (เน็ต/RLS) → คงค่าเดิมไว้ ดีกว่าล็อกอินไม่ผ่านเพราะเรื่องชื่อ
async function withNames(base: MockSession, userId: string): Promise<MockSession> {
  const sb = getSupabase();
  const out = { ...base };
  // ใช้ user id จาก JWT (claim sub) — ห้ามเรียก auth.getUser() เพราะเป็นคำขอเครือข่ายเพิ่มอีกหนึ่ง
  // ที่ถูกยกเลิกเมื่อผู้ใช้เปลี่ยนหน้าระหว่างรอ แล้วโผล่เป็น console error "Failed to fetch"
  if (userId) {
    try {
      const { data } = await sb.from("profiles").select("name").eq("id", userId).maybeSingle();
      const n = (data as { name?: string } | null)?.name?.trim();
      if (n) out.name = n;
    } catch { /* คงอีเมลไว้ */ }
  }
  if (!out.scopeAll && base.dealerCode) {
    try {
      const { data } = await sb.from("dealers").select("name").eq("code", base.dealerCode).maybeSingle();
      const n = (data as { name?: string } | null)?.name?.trim();
      if (n) out.dealerName = n;
    } catch { /* คงรหัสสาขาไว้ */ }
  }
  return out;
}

/** เข้าสู่ระบบด้วยอีเมล/รหัสผ่านจริง (Supabase Auth) */
export async function sbSignIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  // Supabase คืนข้อความอังกฤษดิบ ("Invalid login credentials") — แปลกรณีนี้เป็นไทยให้ตรงกับ UI ที่เหลือ
  // (เจอจากทดสอบ QA: กรอกรหัสผิดแล้วขึ้นข้อความอังกฤษปนอยู่กลางฟอร์มภาษาไทยทั้งหน้า)
  if (error || !data.session) {
    const raw = error?.message ?? "";
    const msg = /invalid login credentials/i.test(raw) ? ERR_GENERIC : (raw || ERR_GENERIC);
    return { ok: false, error: msg };
  }
  // คืน session ทันที ไม่รอ query ชื่อ — ไม่งั้นทุกหน้าหลังล็อกอินช้าขึ้นเพราะรอ 2 คำขอ
  // ชื่อจริงมาทีหลังผ่าน sbOnChange (RoleContext อัปเดต session ให้เอง)
  return { ok: true, session: sessionFromToken(data.session.access_token, data.user?.email ?? email) };
}

/** เข้าด่วนด้วยบัญชีเดโมที่ seed ไว้ (ปุ่ม HQ / Dealer ในหน้า login) */
export function sbDemoSignIn(key: "hq" | "dealer"): Promise<AuthResult> {
  return sbSignIn(DEMO_EMAIL[key], DEMO_PASSWORD);
}

/** ออกจากระบบ (ล้าง session ฝั่ง Supabase) */
export async function sbSignOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** ฟื้น session ตอนโหลดหน้าใหม่ — คืน MockSession ถ้ายังล็อกอินอยู่ ไม่งั้น null */
export async function sbRestore(): Promise<MockSession | null> {
  const { data } = await getSupabase().auth.getSession();
  const s = data.session;
  if (!s) return null;
  return sessionFromToken(s.access_token, s.user?.email ?? ""); // ชื่อจริงตามมาทาง sbOnChange
}

// ── H4 · รีเซ็ตรหัสผ่านด้วย "ลิงก์ทางอีเมล" (ไม่ต้องใช้ service_role) ──────────────
// ผู้ดูแลกดรีเซ็ต → ระบบส่งลิงก์ไปที่อีเมลล็อกอินของผู้ใช้ → ผู้ใช้กดลิงก์แล้วตั้งรหัสเอง
// ปลอดภัยกว่าการออกรหัสชั่วคราว (ไม่มีใครเห็น/ถือรหัสของคนอื่น) และทำจากฝั่ง client ได้
// เดิม (บั๊ก H4): สร้างสตริงรหัสปลอมแล้วโชว์ให้ก๊อป — ไม่เคยส่งไปที่ระบบยืนยันตัวตนเลย ล็อกอินไม่ได้
export type ResetResult = { ok: true } | { ok: false; error: string };

/** ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล · redirect กลับมาหน้า /reset-password ของแอปเดียวกัน */
export async function sbSendPasswordReset(email: string): Promise<ResetResult> {
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  try {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await getSupabase().auth.resetPasswordForEmail(e, { redirectTo });
    // Supabase ตอบสำเร็จเสมอแม้ไม่พบอีเมล (กัน user enumeration) — ถือว่าส่งแล้ว
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** ตั้งรหัสผ่านใหม่ของ "ผู้ใช้ปัจจุบัน" — ใช้ในหน้า /reset-password หลังกดลิงก์ (มี recovery session แล้ว) */
export async function sbUpdatePassword(newPassword: string): Promise<ResetResult> {
  if (newPassword.length < 8) return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  try {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── H3 · เปลี่ยนรหัสผ่านตัวเอง (จากหน้าโปรไฟล์ ขณะล็อกอินอยู่) ──────────────────────
// เดิม (บั๊ก H3): หน้าโปรไฟล์ตรวจความยาว/ความตรงกันแล้วขึ้น "เปลี่ยนแล้ว" ทันที
//   โดยไม่เคยเรียกระบบยืนยันตัวตนเลย → ล็อกอินด้วยรหัสใหม่ไม่ได้
// ปลอดภัยขึ้น: ยืนยัน "รหัสปัจจุบัน" ด้วยการ sign-in ซ้ำก่อน (กัน session ที่ถูกขโมยเปลี่ยนรหัสง่าย ๆ)
// แล้วค่อย updateUser · Supabase เองไม่บังคับรหัสเดิม เราจึงเช็กเองที่ชั้นนี้
export async function sbChangeOwnPassword(current: string, next: string): Promise<ResetResult> {
  if (next.length < 8) return { ok: false, error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" };
  const sb = getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const email = sess.session?.user?.email;
  if (!email) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  // ยืนยันรหัสปัจจุบัน
  const { error: reauth } = await sb.auth.signInWithPassword({ email, password: current });
  if (reauth) return { ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  // ตั้งรหัสใหม่
  const { error } = await sb.auth.updateUser({ password: next });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** ติดตามการเปลี่ยนสถานะ auth (login/logout/token refresh) — คืนฟังก์ชัน unsubscribe */
export function sbOnChange(cb: (session: MockSession | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, s) => {
    if (!s) { cb(null); return; }
    const base = sessionFromToken(s.access_token, s.user?.email ?? "");
    cb(base);                                   // ใช้งานต่อได้ทันที (ชื่อยังเป็นอีเมล/รหัสสาขา)
    void withNames(base, s.user?.id ?? "").then(full => {  // ได้ชื่อจริงแล้วค่อยส่งซ้ำ
      if (full.name !== base.name || full.dealerName !== base.dealerName) cb(full);
    });
  });
  return () => data.subscription.unsubscribe();
}
