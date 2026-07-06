"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Store, Phone, BarChart2, Package,
  Settings, GitMerge, ScrollText, ChevronDown, Check, Users,
  CalendarDays, FolderOpen, Building2,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";

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
      { label: "ลูกค้า",          href: "/customers",  icon: <Users size={16} /> },
      { label: "ใบเสนอราคา",      href: "/quotations", icon: <ScrollText size={16} /> },
      { label: "แม่แบบ",          href: "/products",   icon: <Package size={16} /> },
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
      { label: "แดชบอร์ดสำนักงานใหญ่", href: "/hq/dashboard",  icon: <LayoutDashboard size={16} /> },
      { label: "ตัวแทน",         href: "/hq/dealers",    icon: <Store size={16} /> },
      { label: "ลูกค้าทั้งเครือ",   href: "/hq/customers",  icon: <Users size={16} /> },
      { label: "ภาพรวมยอดขาย",     href: "/hq/pipeline",   icon: <GitMerge size={16} /> },
      { label: "ใบเสนอราคาทั้งเครือ", href: "/hq/quotations", icon: <ScrollText size={16} /> },
      { label: "แคตตาล็อกแม่แบบ",  href: "/hq/master",     icon: <Package size={16} /> },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { label: "ตั้งค่า", href: "/hq/settings", icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar({ mobileOpen = false, onNavigate }: { mobileOpen?: boolean; onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isHQ, currentKey, switchSession } = useRole();
  const [roleOpen, setRoleOpen] = useState(false);
  // แบรนด์ฝั่ง Dealer = ชื่อ+โลโก้บริษัทจากโปรไฟล์บริษัท (แก้ในหน้าตั้งค่า) → แบรนด์ในแอปตรงกับโปรไฟล์เสมอ
  const [dealerBrand, setDealerBrand] = useState("เชียงใหม่สตีลบิลด์");
  const [dealerLogo, setDealerLogo] = useState("");
  const [hqLogo, setHqLogo] = useState(""); // โลโก้ HQ ที่อัปโหลด (แก้ในหน้าตั้งค่า › บริษัท)
  const [brandWordmark, setBrandWordmark] = useState(""); // โลโก้พร้อมชื่อ (แนวนอน) → ใช้เป็นแบรนด์เต็มแถบเมนู

  useEffect(() => {
    router.prefetch("/hq/dashboard");
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    // อ่านชื่อ+โลโก้ตาม role และอัปเดตทันทีเมื่อบันทึกในหน้าตั้งค่า (event) หรือแท็บอื่น (storage)
    const read = () => {
      if (isHQ) {
        try { setHqLogo(localStorage.getItem("hq_company_logo") || ""); } catch {}
        try { setBrandWordmark(localStorage.getItem("hq_company_wordmark") || ""); } catch {}
        return;
      }
      try {
        const s = localStorage.getItem("dealer_issuer_profile_v2");
        if (s) { const p = JSON.parse(s); if (p.company) setDealerBrand(String(p.company).replace(/^บริษัท\s*/, "").replace(/\s*จำกัด$/, "").trim()); }
      } catch {}
      try { setDealerLogo(localStorage.getItem("dealer_company_logo_v2") || ""); } catch {}
      try { setBrandWordmark(localStorage.getItem("dealer_company_wordmark_v2") || ""); } catch {}
    };
    read();
    window.addEventListener("bpms-company-updated", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("bpms-company-updated", read); window.removeEventListener("storage", read); };
  }, [isHQ]);

  function handleSwitch(key: "hq" | "dealer") {
    setRoleOpen(false);
    if (key !== currentKey) {
      switchSession(key);
      router.push(key === "hq" ? "/hq/dashboard" : "/dashboard");
    }
  }

  const nav = isHQ ? HQ_NAV : DEALER_NAV;
  const brandLogo = isHQ ? hqLogo : dealerLogo; // มีโลโก้อัปโหลดหรือไม่ (ใช้สลับพื้นกรอบเป็นขาว)

  return (
    <aside className={`erp-sidebar${mobileOpen ? " open" : ""}`}>
      {/* Brand — HQ = Benjamin (สำนักงานใหญ่) · Dealer = แบรนด์บริษัทของตัวแทนเอง (จากโปรไฟล์บริษัท) */}
      <div className="sidebar-brand">
        {brandWordmark ? (
          /* โลโก้พร้อมชื่อ (แนวนอน) → ใช้เป็นแบรนด์เต็มแถว แทนไอคอน+ตัวอักษร */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={brandWordmark} alt="" style={{ maxWidth: "100%", maxHeight: 40, objectFit: "contain" }} />
        ) : (
        <>
        {/* โลโก้อัปโหลด (มักเป็นสีเข้ม) → พื้นกรอบเป็นขาวกันกลืนพื้นกรม */}
        <div className="brand-mark" style={brandLogo ? { background: "#fff", padding: 4 } : undefined}>
          {isHQ
            ? hqLogo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={hqLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              /* eslint-disable-next-line @next/next/no-img-element */
              : <img src="/benjamin-logo-white.png" alt="Benjamin" style={{ width: 26, height: 26, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            : dealerLogo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={dealerLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <Building2 size={20} color="#fff" strokeWidth={2.2} />}
        </div>
        <div className="brand-text">
          <h1>{isHQ ? "BENJAMIN" : dealerBrand}</h1>
          <span>{isHQ ? "PRE-ENGINEERED BUILDING" : "อาคารเหล็กสำเร็จรูป"}</span>
        </div>
        </>
        )}
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
    </aside>
  );
}
