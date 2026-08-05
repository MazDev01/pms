"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Store, Phone, BarChart2, Package,
  Settings, GitMerge, ScrollText, Users,
  CalendarDays, FolderOpen, Building2, History, LogOut, Crown,
} from "lucide-react";
import { useRole } from "@pms/shared/context/RoleContext";
import { useUserProfile } from "@pms/shared/lib/useUserProfile";
import { type UserProfile } from "@pms/shared/lib/mock";

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
  const { isHQ, session, logout } = useRole();
  // แถบเมนูใช้แบรนด์ Benjamin มาตรฐานเดียวเสมอทุกบทบาท (ดู .sidebar-brand ด้านล่าง)
  // — เดิมอ่านโลโก้/ชื่อแบรนด์จาก localStorage มาเก็บใน state แต่ไม่เคยเอาไปแสดง (โค้ดตาย) จึงเอาออก
  // โปรไฟล์ผู้ใช้ (/profile) → ชื่อ/รูปในการ์ดเจ้าของท้าย sidebar อัปเดตทันทีเมื่อบันทึก (แหล่งเดียวกับ Topbar)
  // โปรไฟล์ผ่าน repo — เดิมอ่าน localStorage ต่อสาขา (ผู้ใช้ในสาขาเดียวกันทับกันเอง)
  const { profile } = useUserProfile();

  // เดิม prefetch ทั้งสองเส้นทางไม่ว่าง role ไหน — เส้นทางของอีกแอปไม่มีจริงในแอปนี้ (dealer ไม่มี /hq/*
  // และกลับกัน) ยิง 404 ซ้ำ ๆ ทุกครั้งที่ Sidebar โหลด (พบจริงจากทดสอบโหลด: เกือบ 300 ครั้งใน log)
  useEffect(() => {
    router.prefetch(isHQ ? "/hq/dashboard" : "/dashboard");
  }, [router, isHQ]);



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
        {/* ชื่อแบรนด์ ไม่ใช่หัวข้อหลักของหน้า — h1 จริงอยู่ที่ Topbar (เปลี่ยนตามหน้า)
            เดิมเป็น h1 ทั้งคู่ → ทุกหน้ามี h1 ซ้ำ 2 อัน screen reader/SEO สับสนว่าอันไหนคือหัวข้อจริง */}
        <div className="brand-text">
          <div className="brand-name">BENJAMIN</div>
          <span>{isHQ ? "PRE-ENGINEERED BUILDING" : "EASYBUILD"}</span>
        </div>
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
        {/* ขนาดต้องพอดีกับแถบข้างตัวแทนที่กว้างแค่ 200px — อวตาร 46px + ฟอนต์ 0.82/0.74
            เคยกินที่จนชื่อโดนตัดเหลือ "เชียงใหม่ส…" และป้ายบทบาทพับสองบรรทัด (บอสสั่งปรับ 17 ก.ค. 69) */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6, padding: "12px 8px 4px", borderTop: "1px solid var(--border)" }}>
          {profile?.avatar
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={profile.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "var(--primary)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: 900 }}>
                {(displayName || "?").trim().charAt(0)}
              </span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayName}>{displayName}</div>
            <div style={{ fontSize: "0.66rem", color: "var(--muted-foreground)", fontWeight: 600, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isHQ ? "เจ้าของแพลตฟอร์ม" : "เจ้าของบัญชีตัวแทน"}</div>
          </div>
          <Crown size={15} color="#e11d48" fill="#e11d48" strokeWidth={1.5} style={{ flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}
