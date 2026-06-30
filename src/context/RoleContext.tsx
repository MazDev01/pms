"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { sessions, type MockSession, type UserRole } from "@/lib/mock";
import { hasPermission, type Permission } from "@/lib/permissions";

type RoleContextType = {
  session: MockSession;
  isLoggedIn: boolean;
  hydrated: boolean;
  isHQ: boolean;
  role: UserRole;
  dealerCode: string;
  can: (permission: Permission) => boolean;
  login: (key: "hq" | "dealer") => void;
  logout: () => void;
  switchSession: (key: "hq" | "dealer") => void;
  currentKey: "hq" | "dealer";
};

const RoleContext = createContext<RoleContextType | null>(null);

const STORAGE_KEY = "pms_session_key";
const STORAGE_LOGIN = "pms_logged_in";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentKey, setCurrentKey] = useState<"hq" | "dealer">("dealer");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const session = sessions[currentKey];

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY) as "hq" | "dealer" | null;
    const savedLogin = localStorage.getItem(STORAGE_LOGIN);
    if (savedKey && savedLogin === "true") {
      setCurrentKey(savedKey);
      setIsLoggedIn(true);
    }
    setHydrated(true);
  }, []);

  const login = (key: "hq" | "dealer") => {
    setCurrentKey(key);
    setIsLoggedIn(true);
    localStorage.setItem(STORAGE_KEY, key);
    localStorage.setItem(STORAGE_LOGIN, "true");
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LOGIN);
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
        login,
        logout,
        switchSession: login,
        currentKey,
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
