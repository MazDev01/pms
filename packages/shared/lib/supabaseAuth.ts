"use client";

// ชั้น AUTH ฝั่ง Supabase (Phase 0) — เชื่อม Supabase Auth จริง
//   signInWithPassword · signOut · restore session · onAuthStateChange
// อ่าน dealer_code / user_role จาก JWT claims (ใส่โดย custom_access_token_hook ที่ DB)
// แล้วปั้นเป็น MockSession รูปเดียวกับโหมด local → RoleContext ใช้ร่วมกันได้ทั้งสองโหมด
import { getSupabase } from "./data/supabase/client";
import type { AuthResult } from "./auth";
import { friendlyError } from "./friendlyError";
import type { MockSession, UserRole } from "./mock";
import { HQ_ROLES } from "./permissions";

const isHQRole = (r: UserRole): boolean => HQ_ROLES.includes(r);

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
// โทเค็นเพี้ยน/ไม่ใช่ JWT/ไม่มี custom claim ที่ custom_access_token_hook ใส่ให้เลย → คืน null (ห้ามเดาเป็น HQ)
//   เดิม decode พังแล้วได้ {} → dealer_code default เป็น "" → ตีความเป็น HQ เสมอ (Medium, พบจากผลตรวจสอบ 30 ก.ค. 69)
//   RLS ฝั่ง DB ยังกันข้อมูลจริงไว้อยู่แล้ว แต่ UI ไม่ควรเปิดเปลือก HQ ให้บัญชีสิทธิ์ต่ำเห็นเลยตั้งแต่แรก
function sessionFromToken(accessToken: string, email: string): MockSession | null {
  const c = decodeClaims(accessToken);
  if (typeof c.user_role !== "string") return null;
  const role = c.user_role as UserRole;
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
  localSignInAt = Date.now();   // บอกตัวกันสลับบัญชีว่าครั้งนี้แท็บนี้กดเอง อย่าสั่งโหลดหน้าใหม่
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
  const session = sessionFromToken(data.session.access_token, data.user?.email ?? email);
  if (!session) return { ok: false, error: ERR_GENERIC };
  return { ok: true, session };
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
  const session = sessionFromToken(s.access_token, s.user?.email ?? ""); // ชื่อจริงตามมาทาง sbOnChange
  // โทเค็นที่ถืออยู่เพี้ยน (แก้ไข sessionStorage เอง/ไฟล์เก่าค้าง) → เคลียร์ session ทิ้งเลย ไม่ใช่แค่ปฏิเสธหน้านี้
  if (!session) { await sbSignOut(); return null; }
  return session;
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
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

/** ตั้งรหัสผ่านใหม่ของ "ผู้ใช้ปัจจุบัน" — ใช้ในหน้า /reset-password หลังกดลิงก์ (มี recovery session แล้ว) */
export async function sbUpdatePassword(newPassword: string): Promise<ResetResult> {
  if (newPassword.length < 8) return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  try {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
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
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

// ── ตัวกันบัญชีปนกันข้ามแท็บ ──────────────────────────────────────────────────────
//
// ใบผ่านเข้าระบบเก็บใน localStorage = ทุกแท็บใช้ร่วมกัน (เพื่อให้เปิดแท็บใหม่แล้วไม่ต้องล็อกอินซ้ำ)
// ผลข้างเคียงที่ต้องกัน: ล็อกอินบัญชีอื่นในแท็บใหม่ แท็บเก่าจะได้ session ของบัญชีใหม่มาแทน
// ถ้าปล่อยให้ setSession เฉย ๆ แท็บเก่าจะเอาข้อมูลบัญชีใหม่มาปะทับหน้าจอที่ยังค้างของบัญชีเดิม
// (หัวจอเขียนสาขาหนึ่ง ตารางข้างล่างเป็นอีกสาขา) — เคยเจอจริงตอนทดสอบ QA
//
// โหลดหน้าใหม่ทั้งหน้าเมื่อ "คนที่ล็อกอินเปลี่ยนคน" เท่านั้น — ต่ออายุใบผ่านหรือรีเฟรชปกติ
// ผู้ใช้คนเดิม จึงไม่โดนโหลดใหม่ (เช็กที่ id ของผู้ใช้ ไม่ใช่ที่ตัวใบผ่านซึ่งเปลี่ยนทุก 10 นาที)
//
// ⚠️ ต้องยกเว้น "แท็บที่กดล็อกอินเอง" ด้วย ไม่งั้นเจอบั๊กนี้ (เจอตอนทดสอบ 11 ส.ค. 69):
//   ออกจากระบบไม่ได้กด แต่ไปหน้าเข้าสู่ระบบแล้วล็อกอินอีกบัญชี → แท็บนั้นเห็นว่า "คนเปลี่ยน"
//   เลยสั่งโหลดหน้าใหม่ทับการพาไปหน้าแดชบอร์ด ผู้ใช้ค้างอยู่หน้าเข้าสู่ระบบทั้งที่ล็อกอินสำเร็จแล้ว
//   จึงจดเวลาที่แท็บนี้กดล็อกอินไว้ แล้วเว้นช่วงสั้น ๆ ให้การล็อกอินของตัวเองเดินจนจบ
let tabUserId: string | null = null;
let localSignInAt = 0;
const LOCAL_SIGNIN_GRACE_MS = 5000;

/** ติดตามการเปลี่ยนสถานะ auth (login/logout/token refresh) — คืนฟังก์ชัน unsubscribe */
export function sbOnChange(cb: (session: MockSession | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, s) => {
    if (!s) { tabUserId = null; cb(null); return; }
    const uid = s.user?.id ?? "";
    const justSignedInHere = Date.now() - localSignInAt < LOCAL_SIGNIN_GRACE_MS;
    if (tabUserId && uid && uid !== tabUserId && !justSignedInHere) {
      if (typeof window !== "undefined") window.location.reload();
      return;
    }
    tabUserId = uid;
    const base = sessionFromToken(s.access_token, s.user?.email ?? "");
    if (!base) { cb(null); void sbSignOut(); return; } // โทเค็นเพี้ยนกลางเซสชัน → ออกจากระบบ ไม่ใช่ถือ session ผี
    cb(base);                                   // ใช้งานต่อได้ทันที (ชื่อยังเป็นอีเมล/รหัสสาขา)
    void withNames(base, s.user?.id ?? "").then(full => {  // ได้ชื่อจริงแล้วค่อยส่งซ้ำ
      if (full.name !== base.name || full.dealerName !== base.dealerName) cb(full);
    });
  });
  return () => data.subscription.unsubscribe();
}
