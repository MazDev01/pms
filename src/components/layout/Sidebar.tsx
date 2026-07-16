"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Store, Phone, BarChart2, Package,
  Settings, GitMerge, ScrollText, ChevronDown, Check, Users,
  CalendarDays, FolderOpen, Building2, History, LogOut, Crown,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { loadUserProfile, PROFILE_UPDATED_EVENT, type UserProfile } from "@/lib/mock";

const ROLE_OPTIONS: { key: "dealer" | "hq"; dot: string; label: string }[] = [
  { key: "dealer", dot: "#ECC94B", label: "Dealer · ตัวแทน" },
  { key: "hq",     dot: "#059669", label: "HQ · สำนักงานใหญ่" },
];

type NavItem = { label: string; href: string; icon: React.ReactNode; badge?: number };
type NavGroup = { group: string; items: NavItem[] };

// Dealer = ฝ่ายขายล้วน (Sales-only)
// ตามสเปก Dealer modules: Dashboard · Leads · Customers · Sales Journey · Quotations · Product Catalog · Calendar · Files · Reports · Settings
const DEALER_NAV: NavGroup[] = [
  {
    group: "เมนูหลัก",
    items: [
      { label: "แดชบอร์ด",        href: "/dashboard",  icon: <LayoutDashboard size={16} /> },
      { label: "ลูกค้าเป้าหมาย",  href: "/leads",      icon: <Phone size={16} /> },
      { label: "ใบเสนอราคา",      href: "/quotations", icon: <ScrollText size={16} /> },
      { label: "ลูกค้า",          href: "/customers",  icon: <Users size={16} /> },
      { label: "แม่แบบ",          href: "/products",   icon: <Package size={16} /> },
    ],
  },
  {
    group: "เครื่องมือ",
    items: [
      { label: "ปฏิทิน", href: "/calendar", icon: <CalendarDays size={16} /> },
      { label: "ไฟล์",   href: "/files",    icon: <FolderOpen size={16} /> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { label: "ตั้งค่า", href: "/settings", icon: <Settings size={16} /> },
    ],
  },
];

// ตามสเปก HQ modules: Executive Dashboard · Dealer Management · Analytics · Leads (ทุก Dealer) · Product Catalog · Settings
// ลำดับ "ภาพรวมยอดขาย" มาก่อน "ลูกค้าเป้าหมายทั้งเครือ" — บอสสั่ง 16 ก.ค. 69
const HQ_NAV: NavGroup[] = [
  {
    group: "เมนูหลัก",
    items: [
      { label: "แดชบอร์ดสำนักงานใหญ่", href: "/hq/dashboard",  icon: <LayoutDashboard size={16} /> },
      { label: "ตัวแทนจำหน่าย",     href: "/hq/dealers",    icon: <Store size={16} /> },
      { label: "ภาพรวมยอดขาย",     href: "/hq/pipeline",   icon: <GitMerge size={16} /> },
      { label: "ลูกค้าเป้าหมายทั้งเครือ", href: "/hq/leads",  icon: <Phone size={16} /> },
      { label: "ใบเสนอราคาทั้งเครือ", href: "/hq/quotations", icon: <ScrollText size={16} /> },
      { label: "ลูกค้าทั้งเครือ",   href: "/hq/customers",  icon: <Users size={16} /> },
      { label: "แคตตาล็อกแม่แบบ",  href: "/hq/master",     icon: <Package size={16} /> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { label: "บันทึกการใช้งาน", href: "/hq/audit", icon: <History size={16} /> },
      { label: "ตั้งค่า", href: "/hq/settings", icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar({ mobileOpen = false, onNavigate }: { mobileOpen?: boolean; onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isHQ, currentKey, switchSession, session, logout } = useRole();
  const [roleOpen, setRoleOpen] = useState(false);
  // แถบเมนูใช้แบรนด์ Benjamin มาตรฐานเดียวเสมอทุกบทบาท (ดู .sidebar-brand ด้านล่าง)
  // — เดิมอ่านโลโก้/ชื่อแบรนด์จาก localStorage มาเก็บใน state แต่ไม่เคยเอาไปแสดง (โค้ดตาย) จึงเอาออก
  // โปรไฟล์ผู้ใช้ (/profile) → ชื่อ/รูปในการ์ดเจ้าของท้าย sidebar อัปเดตทันทีเมื่อบันทึก (แหล่งเดียวกับ Topbar)
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    router.prefetch("/hq/dashboard");
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    const read = () => setProfile(loadUserProfile(session.dealerCode, session.name));
    read();
    window.addEventListener(PROFILE_UPDATED_EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(PROFILE_UPDATED_EVENT, read); window.removeEventListener("storage", read); };
  }, [session.dealerCode, session.name]);

  function handleSwitch(key: "hq" | "dealer") {
    setRoleOpen(false);
    if (key !== currentKey) {
      switchSession(key);
      router.push(key === "hq" ? "/hq/dashboard" : "/dashboard");
    }
  }

  const nav = isHQ ? HQ_NAV : DEALER_NAV;
  // ชื่อในการ์ดเจ้าของ = ชื่อเดียวทั้งแอป · ดีลเลอร์ใช้ชื่อบริษัท/ตัวแทน · HQ ใช้ชื่อผู้ใช้
  const displayName = isHQ ? (profile?.name || session.name) : session.dealerName;

  return (
    <aside className={`erp-sidebar${mobileOpen ? " open" : ""}`}>
      {/* Brand — แบรนด์ Benjamin เท่านั้นทุกบทบาท (ตัวแทนเปลี่ยนโลโก้/แบรนด์เองไม่ได้) */}
      <div className="sidebar-brand">
        <div className="brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/benjamin-logo-white.png" alt="Benjamin" style={{ width: 26, height: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="brand-text">
          <h1>BENJAMIN</h1>
          <span>{isHQ ? "PRE-ENGINEERED BUILDING" : "EASYBUILD"}</span>
        </div>
      </div>

      {/* Role switcher */}
      <div style={{ padding: "0.6rem 0.7rem 0.2rem", position: "relative" }}>
        <button
          onClick={() => setRoleOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            background: "var(--muted)", borderRadius: 8, padding: "7px 10px",
            border: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
          }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: isHQ ? "#059669" : "#ECC94B" }} />
          <span style={{ fontSize: "0.65rem", color: "#475569", fontWeight: 700, flex: 1 }}>
            {isHQ ? "HQ · สำนักงานใหญ่" : "Dealer · ตัวแทน"}
          </span>
          <ChevronDown size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0, transform: roleOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>

        {roleOpen && (
          <>
            <div onClick={() => setRoleOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{
              position: "absolute", top: "calc(100% - 0.1rem)", left: "0.7rem", right: "0.7rem", zIndex: 50,
              background: "#fff", borderRadius: 10, padding: 4, border: "1px solid var(--border)",
              boxShadow: "0 12px 32px rgba(0,0,0,.12)",
            }}>
              {ROLE_OPTIONS.map(opt => {
                const active = currentKey === opt.key;
                return (
                  <button key={opt.key} onClick={() => handleSwitch(opt.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
                      background: active ? "rgba(0,51,102,0.08)" : "transparent",
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: opt.dot }} />
                    <span style={{ fontSize: "0.72rem", flex: 1, color: active ? "#003366" : "#475569", fontWeight: active ? 700 : 500 }}>
                      {opt.label}
                    </span>
                    {active && <Check size={14} style={{ color: "#003366", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ paddingBottom: 16 }}>
        {nav.map(group => (
          <div key={group.group} className="nav-section">
            <div className="nav-label">{group.group}</div>
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} className={`nav-item${active ? " active" : ""}`}>
                  {item.icon}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? <span className="badge-mini">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer — Log Out + การ์ดเจ้าของ (HQ=เจ้าของแพลตฟอร์ม · ตัวแทน=เจ้าของบัญชีตัวแทน) */}
      <div className="sidebar-footer" style={{ padding: "8px 10px 10px" }}>
        <button onClick={logout} className="nav-item"
          style={{ width: "100%", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <LogOut size={16} /> <span style={{ flex: 1, textAlign: "left" }}>ออกจากระบบ</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, padding: "14px 8px 4px", borderTop: "1px solid var(--border)" }}>
          {profile?.avatar
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={profile.avatar} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "var(--primary)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem", fontWeight: 900 }}>
                {(displayName || "?").trim().charAt(0)}
              </span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)", fontWeight: 600, marginTop: 1 }}>{isHQ ? "เจ้าของแพลตฟอร์ม" : "เจ้าของบัญชีตัวแทน"}</div>
          </div>
          <Crown size={18} color="#e11d48" fill="#e11d48" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
