"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FilterProvider } from "@/context/FilterContext";

// เชลล์ของเวิร์กสเปซ — ถือสถานะเปิด/ปิดเมนูมือถือ (hamburger drawer)
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  return (
    <div className="app">
      <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setNavOpen(o => !o)} />
        {/* ตัวกรองแยกอิสระต่อหน้า — key+storageKey ต่อ pathname (เปลี่ยนหน้า A ไม่กระทบหน้า B) */}
        <div className="content">
          <FilterProvider key={pathname} storageKey={`bpms_filters:${pathname}`}>
            {children}
          </FilterProvider>
        </div>
      </div>
    </div>
  );
}
