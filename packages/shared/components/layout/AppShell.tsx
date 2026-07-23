"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { FilterProvider } from "@pms/shared/context/FilterContext";
import { useRole } from "@pms/shared/context/RoleContext";
import { useSales } from "@pms/shared/context/SalesContext";
import { purgeOldDealerKeys } from "@pms/shared/lib/mock";
import { REPO_SAVE_ERROR_EVENT } from "@pms/shared/lib/useRepoState";

// แถบเตือน "บันทึกไม่สำเร็จ" (C1) — ต้องเห็นทุกหน้า เพราะการเขียนเป็น optimistic
// ถ้าไม่แจ้ง ผู้ใช้จะเข้าใจว่าบันทึกแล้วทั้งที่ DB ปฏิเสธ (เช่น RLS/เน็ตหลุด)
function SyncErrorBar() {
  const { syncError, clearSyncError } = useSales();
  // ข้อมูลระดับเครือ (ทะเบียนตัวแทน/แคตตาล็อก/ตั้งค่า) บันทึกผ่าน useRepoState คนละทางกับงานขาย
  // แต่ต้องเตือนที่เดียวกัน — ไม่งั้นลบตัวแทนไม่สำเร็จแล้วผู้ใช้ไม่รู้เลย
  const [repoError, setRepoError] = useState<string | null>(null);
  useEffect(() => {
    const onErr = (e: Event) => setRepoError((e as CustomEvent<string>).detail || "บันทึกไม่สำเร็จ");
    window.addEventListener(REPO_SAVE_ERROR_EVENT, onErr);
    return () => window.removeEventListener(REPO_SAVE_ERROR_EVENT, onErr);
  }, []);

  if (repoError && !syncError) {
    return (
      <div role="alert" style={{
        display: "flex", alignItems: "center", gap: 10, margin: "10px 16px 0",
        background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
        borderRadius: 10, padding: "10px 14px", fontSize: "0.8rem", fontWeight: 600,
      }}>
        <span style={{ flex: 1 }}>บันทึกไม่สำเร็จ: {repoError} · การเปลี่ยนแปลงยังไม่ถูกบันทึก กรุณาลองใหม่</span>
        <button onClick={() => setRepoError(null)} aria-label="ปิดการแจ้งเตือน"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 800 }}>✕</button>
      </div>
    );
  }
  if (!syncError) return null;
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "center", gap: 10, margin: "10px 16px 0",
      background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
      borderRadius: 10, padding: "10px 14px", fontSize: "0.8rem", fontWeight: 600,
    }}>
      <span style={{ flex: 1 }}>{syncError} · ระบบดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์มาแสดงแทนแล้ว</span>
      <button onClick={clearSyncError} aria-label="ปิดการแจ้งเตือน"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 800 }}>✕</button>
    </div>
  );
}

// เชลล์ของเวิร์กสเปซ — ถือสถานะเปิด/ปิดเมนูมือถือ (hamburger drawer)
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  // ล้างรายชื่อตัวแทนรุ่นเก่าที่ค้างในเครื่อง (ดู HQ_DEALERS_KEY ใน mock.ts) — ทำครั้งเดียวตอนเข้าแอป
  useEffect(() => { purgeOldDealerKeys(); }, []);
  const { isHQ } = useRole(); // เมนู HQ ชื่อยาวกว่า (แดชบอร์ดสำนักงานใหญ่ / ใบเสนอราคาทั้งเครือ) → ขยายแถบข้าง
  return (
    <div className={`app${isHQ ? " app-hq" : ""}`}>
      <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setNavOpen(o => !o)} />
        <SyncErrorBar />
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
