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
    name: email,
    role,
    dealerName: hq ? "Benjamin HQ" : dealerCode,
    dealerCode,
    scopeAll: hq,
  };
}

/** เข้าสู่ระบบด้วยอีเมล/รหัสผ่านจริง (Supabase Auth) */
export async function sbSignIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) return { ok: false, error: error?.message ?? ERR_GENERIC };
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
  return sessionFromToken(s.access_token, s.user?.email ?? "");
}

/** ติดตามการเปลี่ยนสถานะ auth (login/logout/token refresh) — คืนฟังก์ชัน unsubscribe */
export function sbOnChange(cb: (session: MockSession | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, s) => {
    cb(s ? sessionFromToken(s.access_token, s.user?.email ?? "") : null);
  });
  return () => data.subscription.unsubscribe();
}
