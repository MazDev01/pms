"use client";

// ชั้น AUTH ฝั่ง Supabase (Phase 0) — เชื่อม Supabase Auth จริง
//   signInWithPassword · signOut · restore session · onAuthStateChange
// อ่าน dealer_code / user_role จาก JWT claims (ใส่โดย custom_access_token_hook ที่ DB)
// แล้วปั้นเป็น MockSession รูปเดียวกับโหมด local → RoleContext ใช้ร่วมกันได้ทั้งสองโหมด
import { getSupabase } from "./data/supabase/client";
import { DEMO_PASSWORD, type AuthResult } from "./auth";
import type { MockSession, UserRole } from "./mock";

const HQ_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "HQ_MANAGEMENT", "HQ_STAFF"];
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
  if (error || !data.session) return { ok: false, error: error?.message ?? ERR_GENERIC };
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
