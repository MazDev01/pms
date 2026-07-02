"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Store, Phone, BarChart2, Package,
  Settings, GitMerge, ScrollText, ChevronDown, Check, Users,
  CalendarDays, FolderOpen, Inbox,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";

const ROLE_OPTIONS: { key: "dealer" | "hq"; dot: string; label: string }[] = [
  { key: "dealer", dot: "#ECC94B", label: "Dealer · สาขา" },
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
      { label: "แดชบอร์ด",      href: "/dashboard",  icon: <LayoutDashboard size={16} /> },
      { label: "ผู้สนใจ",       href: "/leads",      icon: <Phone size={16} /> },
      { label: "ลูกค้า",        href: "/customers",  icon: <Users size={16} /> },
      { label: "เส้นทางการขาย", href: "/pipeline",   icon: <GitMerge size={16} /> },
      { label: "ใบเสนอราคา",    href: "/quotations", icon: <ScrollText size={16} /> },
      { label: "แม่แบบ",         href: "/products", icon: <Package size={16} /> },
    ],
  },
  {
    group: "เครื่องมือ",
    items: [
      { label: "ปฏิทิน", href: "/calendar", icon: <CalendarDays size={16} /> },
      { label: "ไฟล์",   href: "/files",    icon: <FolderOpen size={16} /> },
      { label: "รายงาน", href: "/reports",  icon: <BarChart2 size={16} /> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { label: "ตั้งค่า", href: "/settings", icon: <Settings size={16} /> },
    ],
  },
];

// ตามสเปก HQ modules: Executive Dashboard · Dealer Management · Leads (ทุก Dealer) · Analytics · Product Catalog · Settings
const HQ_NAV: NavGroup[] = [
  {
    group: "เมนูหลัก",
    items: [
      { label: "แดชบอร์ด",      href: "/hq/dashboard", icon: <LayoutDashboard size={16} /> },
      { label: "ตัวแทนจำหน่าย", href: "/hq/dealers",   icon: <Store size={16} /> },
      { label: "ผู้สนใจ",       href: "/hq/lead-pool", icon: <Inbox size={16} /> },
      { label: "ลูกค้า",        href: "/hq/customers", icon: <Users size={16} /> },
      { label: "เส้นทางการขาย", href: "/hq/pipeline",  icon: <GitMerge size={16} /> },
      { label: "สินค้า",        href: "/hq/master",    icon: <Package size={16} /> },
      { label: "รายงาน",         href: "/reports",      icon: <BarChart2 size={16} /> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { label: "ตั้งค่า", href: "/hq/settings", icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isHQ, currentKey, switchSession } = useRole();
  const [roleOpen, setRoleOpen] = useState(false);

  useEffect(() => {
    router.prefetch("/hq/dashboard");
    router.prefetch("/dashboard");
  }, [router]);

  function handleSwitch(key: "hq" | "dealer") {
    setRoleOpen(false);
    if (key !== currentKey) {
      switchSession(key);
      router.push(key === "hq" ? "/hq/dashboard" : "/dashboard");
    }
  }

  const nav = isHQ ? HQ_NAV : DEALER_NAV;

  return (
    <aside className="erp-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/benjamin-logo-white.png" alt="Benjamin"
            style={{ width: 26, height: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="brand-text">
          <h1>BENJAMIN</h1>
          <span>PRE-ENGINEERED BUILDING</span>
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
          <span style={{ fontSize: "0.68rem", color: "#475569", fontWeight: 700, flex: 1 }}>
            {isHQ ? "HQ · สำนักงานใหญ่" : "Dealer · สาขา"}
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
                    <span style={{ fontSize: "0.74rem", flex: 1, color: active ? "#003366" : "#475569", fontWeight: active ? 700 : 500 }}>
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
                <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                  {item.icon}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? <span className="badge-mini">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
