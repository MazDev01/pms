"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { sessions, type MockSession, type UserRole } from "@pms/shared/lib/mock";
import { hasPermission, HQ_ROLES, type Permission } from "@pms/shared/lib/permissions";
import { authenticate, type AuthResult } from "@pms/shared/lib/auth";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";
import { sbSignIn, sbSignOut, sbRestore, sbOnChange } from "@pms/shared/lib/supabaseAuth";
import { audit as auditRepo } from "@pms/shared/lib/data";
import { isAbortedRequest } from "@pms/shared/lib/repoLog";

// Phase 9 (Logging/Audit) — เดิมระบบไม่บันทึกเข้า/ออกจากระบบเลย (มีแต่ mutation ของ admin)
// เข้าสู่ระบบ/ออกจากระบบเป็นเหตุการณ์ที่ audit trail มาตรฐานต้องมี — บันทึกล้มเหลวต้องไม่บล็อกการ
// เข้า/ออกระบบจริง แต่ต้อง "ดังพอให้รู้" ไม่ใช่เงียบสนิท ไม่งั้นร่องรอยการเข้าระบบดับไปโดยไม่มีใครรู้
// (แนวเดียวกับ auditLog ใน adminRoute.ts ฝั่งเซิร์ฟเวอร์)
//
// ⚠️ ต้องข้ามกรณีคำขอถูกยกเลิก: ทันทีที่ล็อกอินสำเร็จ แอปจะพาไปหน้าใหม่ เบราว์เซอร์จึงยกเลิกคำขอ
//    audit ที่ยังค้างอยู่เป็นปกติ (ได้ "Failed to fetch" เหมือนเน็ตหลุดเป๊ะ) — ถ้าไม่กรอง จะมี error
//    ขึ้นทุกครั้งที่ล็อกอินสำเร็จ ทั้งที่ไม่มีอะไรผิด (เจอจริงตอนรันชุดทดสอบหลังแก้รอบนี้)
function logAuthEvent(action: string, s: MockSession) {
  // บันทึกตรวจสอบเป็นของสำนักงานใหญ่เท่านั้น (ดู /hq/audit) — ฐานข้อมูลปฏิเสธการเขียนจากตัวแทนอยู่แล้ว
  //   เดิมแอปตัวแทนก็ยิงคำสั่งนี้ทุกครั้งที่ล็อกอิน แล้วโดนปฏิเสธ 403 ทุกครั้ง
  //   → ผู้ใช้เห็น error ค้างใน console ทุกการล็อกอิน และชุดทดสอบที่ตรวจ "ต้องไม่มี error" ก็ล้มตาม
  //   ไม่ใช่ปัญหาสิทธิ์ที่ต้องเปิดเพิ่ม แต่เป็นการ "เรียกในสิ่งที่ไม่ควรเรียกตั้งแต่ต้น"
  //   (พบจากการรันชุดเต็ม 6 ส.ค. 69 · ของเดิมสะสมมาตั้งแต่รัด policy ที่ 0031)
  if (!HQ_ROLES.includes(s.role)) return;
  auditRepo.append({ user: s.name, role: s.role, action, target: s.dealerName })
    .catch(e => { if (!isAbortedRequest(e)) console.error(`[audit] บันทึก "${action}" ไม่สำเร็จ`, e); });
}

// โหมด backend — supabase = auth จริง (JWT) · local = mock เดิม (localStorage)
// "ของจริง" = supabase หรือ api (ไม่ใช่โหมดเดโม) — ดู REAL_BACKEND ใน data/config.ts
const USE_SUPABASE = REAL_BACKEND;

type RoleContextType = {
  session: MockSession;
  isLoggedIn: boolean;
  hydrated: boolean;   // true = ฟื้น session เสร็จ (auth พร้อม → ค่อย query เพื่อกัน RLS คืนว่าง)
  loading: boolean;    // true = ยังฟื้น session ไม่เสร็จ (= !hydrated) — ให้ useAuth ใช้
  isHQ: boolean;
  role: UserRole;
  dealerCode: string;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  login: (key: "hq" | "dealer") => Promise<void>;
  logout: () => void;
  currentKey: "hq" | "dealer";
};

const RoleContext = createContext<RoleContextType | null>(null);

const STORAGE_KEY = "pms_session_key";     // "hq" | "dealer" — คงไว้เพื่อ backward-compat + test harness
const STORAGE_LOGIN = "pms_logged_in";
const STORAGE_SESSION = "pms_session_v2";  // session เต็ม (role จริงทั้ง 6) จากการ login ด้วยบัญชี

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MockSession>(sessions.dealer);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // กู้ session ตอน mount — โหมด supabase ฟื้นจาก JWT · โหมด local ฟื้นจาก localStorage
  useEffect(() => {
    if (USE_SUPABASE) {
      let alive = true;
      sbRestore()
        .then((s) => {
          if (!alive) return;
          if (s) { setSession(s); setIsLoggedIn(true); }
          setHydrated(true);
        })
        .catch(() => { if (alive) setHydrated(true); });
      // ติดตาม login/logout/refresh (เช่น token หมดอายุ) → ซิงก์ session ให้เสมอ
      const unsub = sbOnChange((s) => {
        if (!alive) return;
        if (s) { setSession(s); setIsLoggedIn(true); }
        else { setIsLoggedIn(false); }
      });
      return () => { alive = false; unsub(); };
    }

    // ── โหมด local (mock) ──
    try {
      const loggedIn = localStorage.getItem(STORAGE_LOGIN) === "true";
      // 1) session เต็มจากการ login ด้วยบัญชีจริง
      const saved = localStorage.getItem(STORAGE_SESSION);
      if (loggedIn && saved) {
        const s = JSON.parse(saved) as MockSession;
        if (s && s.role && typeof s.scopeAll === "boolean") {
          setSession(s); setIsLoggedIn(true); setHydrated(true); return;
        }
      }
      // 2) fallback: pms_session_key = "hq"|"dealer" (เดโมเข้าด่วน / role switcher / test harness)
      const key = localStorage.getItem(STORAGE_KEY) as "hq" | "dealer" | null;
      if (loggedIn && key && sessions[key]) {
        setSession(sessions[key]); setIsLoggedIn(true);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const persist = (s: MockSession) => {
    localStorage.setItem(STORAGE_KEY, s.scopeAll ? "hq" : "dealer");
    localStorage.setItem(STORAGE_LOGIN, "true");
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(s));
  };

  // login ด้วยอีเมล/รหัสผ่านจริง → session ตามบทบาทของบัญชี
  // supabase: signInWithPassword (JWT) · local: mock authenticate + persist localStorage
  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (USE_SUPABASE) {
      const r = await sbSignIn(email, password);
      if (r.ok) { setSession(r.session); setIsLoggedIn(true); logAuthEvent("เข้าสู่ระบบ", r.session); }
      return r;
    }
    const r = authenticate(email, password);
    if (r.ok) { setSession(r.session); setIsLoggedIn(true); persist(r.session); logAuthEvent("เข้าสู่ระบบ", r.session); }
    return r;
  };

  // เข้าด่วนด้วย session สำเร็จรูป — ใช้เฉพาะโหมด local (เช่น "เข้าระบบแทนตัวแทน" ในหน้า HQ dealers
  // ซึ่งปิดไว้แล้วในโหมด supabase เพราะสวมสิทธิ์ข้ามบัญชีจริงทำไม่ได้)
  const login = async (key: "hq" | "dealer"): Promise<void> => {
    const s = sessions[key];
    setSession(s); setIsLoggedIn(true); persist(s);
    logAuthEvent("เข้าสู่ระบบ", s);
  };

  const logout = () => {
    setIsLoggedIn(false);
    logAuthEvent("ออกจากระบบ", session);
    if (USE_SUPABASE) { void sbSignOut(); return; }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LOGIN);
    localStorage.removeItem(STORAGE_SESSION);
  };

  return (
    <RoleContext.Provider
      value={{
        session,
        isLoggedIn,
        hydrated,
        loading: !hydrated,
        isHQ: session.scopeAll,
        role: session.role,
        dealerCode: session.dealerCode,
        can: (permission: Permission) => hasPermission(session.role, permission),
        signIn,
        login,
        logout,
        currentKey: session.scopeAll ? "hq" : "dealer",
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}

// useAuth — มุมมอง "ผู้ใช้ปัจจุบัน" ที่กระชับ (ตาม Master Plan Phase 0)
// user = session ปัจจุบัน · dealerCode/role/isHQ มาจาก JWT (supabase) หรือ mock (local)
// loading = ยังฟื้น session ไม่เสร็จ → หน้า/query ควรรอก่อน
export function useAuth() {
  const { session, dealerCode, role, isHQ, loading } = useRole();
  return { user: session, dealerCode, role, isHQ, loading };
}
