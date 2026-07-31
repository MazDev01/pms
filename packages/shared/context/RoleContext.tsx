"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { sessions, type MockSession, type UserRole } from "@pms/shared/lib/mock";
import { hasPermission, type Permission } from "@pms/shared/lib/permissions";
import { authenticate, type AuthResult } from "@pms/shared/lib/auth";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { sbSignIn, sbDemoSignIn, sbSignOut, sbRestore, sbOnChange } from "@pms/shared/lib/supabaseAuth";
import { audit as auditRepo } from "@pms/shared/lib/data";

// Phase 9 (Logging/Audit) — เดิมระบบไม่บันทึกเข้า/ออกจากระบบเลย (มีแต่ mutation ของ admin)
// เข้าสู่ระบบ/ออกจากระบบเป็นเหตุการณ์ที่ audit trail มาตรฐานต้องมี — log ล้มเหลวต้องไม่บล็อกการ
// เข้า/ออกระบบจริง (แค่ log เงียบ ๆ ถ้าพัง)
function logAuthEvent(action: string, s: MockSession) {
  auditRepo.append({ user: s.name, role: s.role, action, target: s.dealerName }).catch(() => {});
}

// โหมด backend — supabase = auth จริง (JWT) · local = mock เดิม (localStorage)
const USE_SUPABASE = DATA_SOURCE === "supabase";

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
  switchSession: (key: "hq" | "dealer") => Promise<void>;
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

  // เข้าด่วนด้วยบัญชีเดโม (ปุ่มในหน้า login / สลับบทบาทใน Sidebar)
  // supabase: signInWithPassword ด้วยบัญชีเดโมที่ seed ไว้ · local: session สำเร็จรูป
  const login = async (key: "hq" | "dealer"): Promise<void> => {
    if (USE_SUPABASE) {
      const r = await sbDemoSignIn(key);
      if (r.ok) { setSession(r.session); setIsLoggedIn(true); logAuthEvent("เข้าสู่ระบบ", r.session); }
      return;
    }
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
        switchSession: login,
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
