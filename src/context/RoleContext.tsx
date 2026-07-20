"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { sessions, type MockSession, type UserRole } from "@/lib/mock";
import { hasPermission, type Permission } from "@/lib/permissions";
import { authenticate, type AuthResult } from "@/lib/auth";

type RoleContextType = {
  session: MockSession;
  isLoggedIn: boolean;
  hydrated: boolean;
  isHQ: boolean;
  role: UserRole;
  dealerCode: string;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => AuthResult;
  login: (key: "hq" | "dealer") => void;
  logout: () => void;
  switchSession: (key: "hq" | "dealer") => void;
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

  // กู้ session จาก localStorage ตอน mount
  useEffect(() => {
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
  const signIn = (email: string, password: string): AuthResult => {
    const r = authenticate(email, password);
    if (r.ok) { setSession(r.session); setIsLoggedIn(true); persist(r.session); }
    return r;
  };

  // เข้าด่วนด้วย session สำเร็จรูป (ปุ่มเดโม / สลับบทบาทใน Sidebar)
  const login = (key: "hq" | "dealer") => {
    const s = sessions[key];
    setSession(s); setIsLoggedIn(true); persist(s);
  };

  const logout = () => {
    setIsLoggedIn(false);
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
