"use client";

// ─── ชั้น AUTH (Phase A) — ตรวจตัวตนจริงกับคลังบัญชีที่มีอยู่ ────────────────────
// interface กลาง: หน้า login / RoleContext เรียกผ่านไฟล์นี้เท่านั้น
// เฟส B (Supabase) จะสลับเฉพาะไฟล์นี้ (supabase.auth.signInWithPassword) โดยที่เหลือไม่ต้องแก้
//
// คลังบัญชี 2 แหล่ง (ของจริงในระบบ ไม่มีการกุ):
//   • ตัวแทน  → hq_dealers_v4 · credentials { email, password } เป็นรหัสจริง (เช่น PEB-CNX-3317)
//   • ผู้ใช้ HQ → hq_users_v4 · มี email/role/status แต่ "ไม่เก็บรหัสผ่าน"
//     (UsersPanel สร้างรหัสชั่วคราวโชว์ครั้งเดียว ไม่ persist) → ฝั่ง login ใช้รหัส demo ที่ประกาศชัด
//     จนกว่าจะถึงเฟส B ที่ Supabase Auth ถือรหัสจริง (bcrypt)

import { loadHQDealers, sessions, type MockSession, type UserRole } from "@pms/shared/lib/mock";

export type AuthResult =
  | { ok: true; session: MockSession }
  | { ok: false; error: string };

// รหัส demo สำหรับบัญชีที่ระบบยังไม่เก็บรหัสจริง (ผู้ใช้ HQ + บัญชีเดโม)
// ตัวแทนใช้รหัสจริงจาก credentials ได้เลย (หรือรหัส demo นี้ก็ได้ในโหมดเดโม)
export const DEMO_PASSWORD = "benjamin";

// แม็พบทบาทภายในของ UsersPanel (5 คีย์) → UserRole ในระบบสิทธิ์ (permissions.ts)
// ทุกบัญชี HQ = scopeAll (เห็นทั้งเครือ) ต่างกันที่ระดับสิทธิ์
const HQ_ROLE_MAP: Record<string, UserRole> = {
  super_admin:    "SUPER_ADMIN",
  executive:      "HQ_MANAGEMENT",
  sales_manager:  "HQ_MANAGEMENT",
  central_sales:  "HQ_STAFF",
  system_officer: "HQ_MANAGEMENT",
};

// บัญชีเดโมในตัว — อีเมลที่หน้า login แนะนำ (ผูกกับ session สำเร็จรูป 2 ตัว)
const BUILT_IN: { email: string; session: MockSession }[] = [
  { email: "admin@benjamin.com", session: sessions.hq },      // ผู้ดูแลสำนักงานใหญ่
  { email: "cnx@dealer.com",     session: sessions.dealer },  // ตัวแทนเชียงใหม่ (CNX)
];

type StoredHQUser = { name: string; email: string; role: string; status: string };

function loadHQUsers(): StoredHQUser[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem("hq_users_v4");
    if (s) { const arr = JSON.parse(s); if (Array.isArray(arr)) return arr; }
  } catch {}
  return [];
}

const ERR_BAD_PASSWORD = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
const ERR_INACTIVE     = "บัญชีนี้ถูกปิดใช้งาน — กรุณาติดต่อผู้ดูแลระบบ";
const ERR_NOT_FOUND    = "ไม่พบบัญชีผู้ใช้นี้ในระบบ";
const ERR_EMPTY        = "กรุณากรอกอีเมลและรหัสผ่าน";

function dealerSession(name: string, code: string): MockSession {
  return { name, role: "DEALER_ADMIN", dealerName: name, dealerCode: code, scopeAll: false };
}
function hqUserSession(u: StoredHQUser): MockSession {
  return {
    name: u.name,
    role: HQ_ROLE_MAP[u.role] ?? "HQ_MANAGEMENT",
    dealerName: "Benjamin HQ",
    dealerCode: "",
    scopeAll: true,
  };
}

/** ตรวจตัวตน — คืน session จริงตามบทบาท หรือ error ที่อ่านรู้เรื่อง */
export function authenticate(email: string, password: string): AuthResult {
  const e = email.trim().toLowerCase();
  if (!e || !password) return { ok: false, error: ERR_EMPTY };

  // 1) บัญชีตัวแทน — ตรวจรหัสจริงจาก credentials
  for (const d of loadHQDealers()) {
    if (d.credentials?.email?.toLowerCase() === e) {
      if (d.status === "inactive") return { ok: false, error: ERR_INACTIVE };
      if (password === d.credentials.password || password === DEMO_PASSWORD) {
        return { ok: true, session: dealerSession(d.name, d.code) };
      }
      return { ok: false, error: ERR_BAD_PASSWORD };
    }
  }

  // 2) บัญชีเดโมในตัว (ผู้ดูแล HQ / ตัวแทน CNX)
  const b = BUILT_IN.find(x => x.email === e);
  if (b) {
    if (password === DEMO_PASSWORD) return { ok: true, session: b.session };
    return { ok: false, error: ERR_BAD_PASSWORD };
  }

  // 3) ผู้ใช้ HQ ที่จัดการในหน้า /hq/users — ระบบยังไม่เก็บรหัส → ใช้รหัส demo
  for (const u of loadHQUsers()) {
    if (u.email?.toLowerCase() === e) {
      if (u.status === "inactive") return { ok: false, error: ERR_INACTIVE };
      if (password === DEMO_PASSWORD) return { ok: true, session: hqUserSession(u) };
      return { ok: false, error: ERR_BAD_PASSWORD };
    }
  }

  return { ok: false, error: ERR_NOT_FOUND };
}
