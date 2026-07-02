"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useSales } from "@/context/SalesContext";
import {
  leads, customers, quotations, dealerLeaderboard, apptTypeLabel,
  type LeadRow, type CustomerMock, type QuotationMock, type DealerRow, type AppointmentMock,
} from "@/lib/mock";
import { Bell, MessageSquare, CheckCircle2, AlertTriangle, UserCircle, Settings, Users, FileText, Sparkles, CalendarClock } from "lucide-react";

// ── mock "วันนี้" (deterministic) ────────────────────────────────
const MOCK_TODAY = "2026-06-30";

const PRIMARY = "#003366";
const BORDER   = "#e5e7eb";
const STEEL    = "#2D2D2D";
const BG       = "#fafafa";

// ── notification shape ───────────────────────────────────────────
type NotifBucket = "today" | "yesterday" | "older";

type Notif = {
  id: number;
  iconEl: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  time: string;
  href: string;
  sortDate: string;   // YYYY-MM-DD ใช้จัดกลุ่ม/เรียงลำดับ (deterministic)
  bucket: NotifBucket;
};

// bucket ตามวันที่เทียบกับ mock วันนี้ = 2026-06-30 (deterministic)
const MOCK_YESTERDAY = "2026-06-29";
function bucketOf(date: string): NotifBucket {
  if (date === MOCK_TODAY) return "today";
  if (date === MOCK_YESTERDAY) return "yesterday";
  return "older"; // ก่อนหน้า (วันที่อื่น/ไม่มีวันที่จริง)
}
const BUCKET_LABEL: Record<NotifBucket, string> = {
  today: "วันนี้",
  yesterday: "เมื่อวาน",
  older: "ก่อนหน้า",
};
const BUCKET_ORDER: NotifBucket[] = ["today", "yesterday", "older"];

// ── สร้างการแจ้งเตือนจาก mock (deterministic, mock วันนี้ = 2026-06-30) ──
// ประเภท: ลีดใหม่ · เตือนติดตาม · เตือนประชุม · ใบเสนอราคาใกล้หมดอายุ · ปิดการขายได้ · เสียโอกาส
// รับ leads/quotations/appointments จาก SalesContext (ข้อมูลสดทั้งหมด)
function buildNotifications(leads: LeadRow[], quotations: QuotationMock[], appointments: AppointmentMock[]): Notif[] {
  const out: Notif[] = [];
  let id = 1;

  const push = (
    n: Omit<Notif, "id" | "bucket"> & { sortDate: string },
  ) => {
    out.push({ ...n, id: id++, bucket: bucketOf(n.sortDate) });
  };

  // 1) ลีดใหม่ (New Lead) — leads status "NEW" → assign เป็น "วันนี้"
  for (const l of leads.filter(l => l.status === "NEW")) {
    push({
      iconEl: <MessageSquare size={14} />, iconBg: "#dce5f0", iconColor: "#003366",
      title: "ผู้สนใจใหม่",
      body: `${l.company} — ${l.contact} · ${l.province} · ${l.value}`,
      time: `${l.source ?? "ช่องทางออนไลน์"} · ผู้รับผิดชอบ ${l.assigned}`,
      href: "/leads",
      sortDate: MOCK_TODAY,
    });
  }

  // 2) เตือนติดตาม (Follow-up Reminder) — leads status "FOLLOWUP" + นัดชนิด follow_up
  for (const l of leads.filter(l => l.status === "FOLLOWUP")) {
    push({
      iconEl: <CalendarClock size={14} />, iconBg: "#fff3cd", iconColor: "#d97706",
      title: "เตือนติดตาม",
      body: `${l.company} — ${l.product} · ${l.value}`,
      time: `ผู้รับผิดชอบ ${l.assigned}`,
      href: "/leads",
      sortDate: MOCK_TODAY,
    });
  }
  for (const a of appointments.filter(a => a.type === "follow_up" && a.status === "upcoming")) {
    push({
      iconEl: <CalendarClock size={14} />, iconBg: "#fff3cd", iconColor: "#d97706",
      title: "เตือนติดตาม",
      body: `${a.company} — ${a.note}`,
      time: `${a.date} ${a.time} น. · ${a.assigned}`,
      href: "/quotations",
      sortDate: a.date,
    });
  }

  // 3) เตือนประชุม (Meeting Reminder) — นัดชนิดพบ/นำเสนอที่ยัง upcoming
  const meetTypes: AppointmentMock["type"][] = ["visit", "design_meet", "presentation", "contract_sign"];
  for (const a of appointments.filter(a => meetTypes.includes(a.type) && a.status === "upcoming")) {
    push({
      iconEl: <CalendarClock size={14} />, iconBg: "#dce5f0", iconColor: "#003366",
      title: "เตือนประชุม",
      body: `${apptTypeLabel[a.type]} — ${a.company} · ${a.province}`,
      time: `${a.date} ${a.time} น. · ${a.assigned}`,
      href: "/calendar",
      sortDate: a.date,
    });
  }

  // 4) ใบเสนอราคาใกล้หมดอายุ (Quotation Expiring) — expired + ส่งแล้วรอตอบรับ
  for (const qt of quotations.filter(qt => qt.status === "expired" || qt.status === "sent_to_client")) {
    push({
      iconEl: <AlertTriangle size={14} />, iconBg: "#fef3cd", iconColor: "#d97706",
      title: "ใบเสนอราคาใกล้หมดอายุ",
      body: `${qt.id} · ${qt.customer} — ${qt.total}`,
      time: `ออกเมื่อ ${qt.date}`,
      href: "/quotations",
      sortDate: qt.date,
    });
  }

  // 5) ปิดการขายได้ (Deal Won) — quotations status "won"
  for (const qt of quotations.filter(qt => qt.status === "won")) {
    push({
      iconEl: <CheckCircle2 size={14} />, iconBg: "#d1fae5", iconColor: "#059669",
      title: "ปิดการขายได้",
      body: `${qt.customer} — ${qt.id} มูลค่า ${qt.total}`,
      time: `ปิดเมื่อ ${qt.date}`,
      href: "/quotations",
      sortDate: qt.date,
    });
  }

  // 6) เสียโอกาส (Deal Lost) — quotations status "lost"
  for (const qt of quotations.filter(qt => qt.status === "lost")) {
    push({
      iconEl: <AlertTriangle size={14} />, iconBg: "#fee2e2", iconColor: "#dc2626",
      title: "เสียโอกาส",
      body: `${qt.customer} — ${qt.id} มูลค่า ${qt.total}`,
      time: `เมื่อ ${qt.date}`,
      href: "/quotations",
      sortDate: qt.date,
    });
  }

  // เรียงตามกลุ่มวันนี้ → เมื่อวาน → ก่อนหน้า แล้ววันที่ใหม่สุดก่อนในแต่ละกลุ่ม (deterministic)
  return out.sort((a, b) => {
    const ba = BUCKET_ORDER.indexOf(a.bucket);
    const bb = BUCKET_ORDER.indexOf(b.bucket);
    if (ba !== bb) return ba - bb;
    if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? 1 : -1;
    return a.id - b.id;
  });
}

type SearchResult = { type: string; label: string; sub: string; href: string };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

const TITLE_MAP: { match: string; title: string }[] = [
  /* Dealer */
  { match: "/dashboard",       title: "แดชบอร์ด" },
  { match: "/pipeline",        title: "เส้นทางการขาย" },
  { match: "/leads",           title: "ผู้สนใจ" },
  { match: "/customers",       title: "ลูกค้า" },
  { match: "/quotations",      title: "ใบเสนอราคา" },
  { match: "/tasks",           title: "งาน" },
  { match: "/calendar",        title: "ปฏิทิน" },
  { match: "/files",           title: "เอกสาร" },
  { match: "/products",        title: "แม่แบบ" },
  { match: "/settings",        title: "ตั้งค่า" },
  /* HQ */
  { match: "/hq/dashboard",      title: "แดชบอร์ด" },
  { match: "/hq/pipeline",       title: "เส้นทางการขาย" },
  { match: "/hq/dealers",        title: "ตัวแทนจำหน่าย" },
  { match: "/hq/lead-pool",      title: "ผู้สนใจ" },
  { match: "/hq/customers",      title: "ลูกค้า" },
  { match: "/hq/master",         title: "สินค้า" },
  { match: "/hq/company",        title: "บริษัท" },
  { match: "/hq/users",          title: "ผู้ใช้งาน" },
  { match: "/hq/settings",        title: "ตั้งค่า HQ" },
  { match: "/templates",         title: "เทมเพลต" },
  { match: "/reports",           title: "รายงาน" },
];

function pageTitle(pathname: string): string {
  const hit = [...TITLE_MAP].sort((a, b) => b.match.length - a.match.length).find(t => pathname.startsWith(t.match));
  return hit?.title ?? "แดชบอร์ด";
}

export function Topbar() {
  const { session, isHQ, currentKey, login, logout } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const initial = session.name.charAt(0).toUpperCase();
  const roleLabel = isHQ ? "ผู้บริหาร HQ"
    : ({ DEALER_ADMIN: "ผู้จัดการสาขา", DEALER_SALES: "เซลส์", DEALER_SITE: "เซลส์ภาคสนาม" } as Record<string, string>)[session.role] ?? "สมาชิก";
  // ข้อมูลสดจาก SalesContext → การแจ้งเตือนอัปเดตทันทีเมื่อเพิ่มลีด/ออกใบเสนอราคา/ปิดการขาย
  const { leads: liveLeads, quotations: liveQuotations, appointments: liveAppointments } = useSales();
  const notifs = useMemo(() => buildNotifications(liveLeads, liveQuotations, liveAppointments), [liveLeads, liveQuotations, liveAppointments]);

  // ── states ──
  const [showSearch, setShowSearch]     = useState(false);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [showUser,   setShowUser]       = useState(false);
  const [searchQ,    setSearchQ]        = useState("");
  const [readIds,    setReadIds]        = useState<Set<number>>(new Set());

  const notifsRef = useRef<HTMLDivElement>(null);
  const userRef   = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeNotifs = useCallback(() => setShowNotifs(false), []);
  const closeUser   = useCallback(() => setShowUser(false),   []);
  useClickOutside(notifsRef, closeNotifs);
  useClickOutside(userRef,   closeUser);

  // open search overlay
  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  // close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setShowSearch(false); setShowNotifs(false); setShowUser(false); } }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── dealer list derived from mock ──
  const dealers = dealerLeaderboard;

  // ── search results (grouped, ≥2 chars, up to 5 per group) ──
  const q = searchQ.trim().toLowerCase();
  const results: SearchResult[] = useMemo(() => {
    if (q.length < 2) return [];
    const has = (s?: string) => (s ?? "").toLowerCase().includes(q);
    // ลูกค้าไม่มี owner field → หาผู้รับผิดชอบจากลีดที่ผูก customerId เดียวกัน
    const ownerOfCustomer = (cid: number) => leads.find(l => l.customerId === cid)?.assigned;
    return [
      // ลีด — match company/contact/name/phone/ผู้รับผิดชอบ
      ...leads
        .filter((l: LeadRow) => has(l.name) || has(l.company) || has(l.contact) || has(l.phone) || has(l.assigned))
        .slice(0, 5)
        .map((l: LeadRow) => {
          // แสดง secondary text ตามสิ่งที่ตรงกัน (เบอร์โทร / ผู้รับผิดชอบ)
          const sub = has(l.phone)
            ? `${l.contact} · ${l.phone ?? ""}`
            : has(l.assigned)
            ? `${l.contact} · ผู้รับผิดชอบ ${l.assigned}`
            : `${l.contact} · ${l.province} · ${l.value}`;
          return { type: "ผู้สนใจ", label: l.company, sub, href: "/leads" };
        }),
      // ลูกค้า — match company/name/province/phone/ผู้รับผิดชอบ (ผ่านลีดที่ผูกกัน)
      ...customers
        .filter((c: CustomerMock) => has(c.company) || has(c.name) || has(c.province) || has(c.phone) || has(ownerOfCustomer(c.id)))
        .slice(0, 5)
        .map((c: CustomerMock) => {
          const owner = ownerOfCustomer(c.id);
          const sub = has(c.phone)
            ? `${c.name} · ${c.phone}`
            : has(owner)
            ? `${c.name} · ผู้รับผิดชอบ ${owner}`
            : `${c.name} · ${c.province}`;
          return { type: "ลูกค้า", label: c.company, sub, href: "/customers" };
        }),
      // ใบเสนอราคา — match id (เลขที่ใบเสนอราคา)/customer/project
      ...quotations
        .filter((qt: QuotationMock) => has(qt.id) || has(qt.customer) || has(qt.project))
        .slice(0, 5)
        .map((qt: QuotationMock) => ({ type: "ใบเสนอราคา", label: qt.id, sub: `${qt.customer} · ${qt.total}`, href: "/quotations" })),
      // ตัวแทนจำหน่าย — match dealer name/code
      ...dealers
        .filter((d: DealerRow) => has(d.name) || has(d.code) || has(d.region))
        .slice(0, 5)
        .map((d: DealerRow) => ({ type: "ตัวแทนจำหน่าย", label: d.name, sub: `${d.code} · ${d.region}`, href: "/hq/dealers" })),
    ];
  }, [q, dealers]);

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  function markAll() { setReadIds(new Set(notifs.map(n => n.id))); }
  function markOne(id: number) { setReadIds(prev => new Set([...prev, id])); }

  function handleLogout() {
    setShowUser(false);
    logout();
    router.push("/login");
  }

  function handleSwitch(key: "hq" | "dealer") {
    setShowUser(false);
    login(key);
    router.push(key === "hq" ? "/hq/dashboard" : "/dashboard");
  }

  function goTo(href: string) {
    setShowSearch(false);
    setSearchQ("");
    router.push(href);
  }

  // ── type badge color + icon per group ──
  const typeMeta: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    "ผู้สนใจ":         { bg: "#dce5f0", text: PRIMARY,   icon: <MessageSquare size={14} /> },
    "ลูกค้า":         { bg: "#e5faf0", text: "#059669", icon: <Users size={14} /> },
    "ใบเสนอราคา":     { bg: "#fef3cd", text: "#b45309", icon: <FileText size={14} /> },
    "ตัวแทนจำหน่าย":  { bg: "#f0e5fa", text: "#7c3aed", icon: <Sparkles size={14} /> },
  };

  return (
    <>
      {/* ── Search overlay ──────────────────────────────────────── */}
      {showSearch && (
        <div
          onClick={() => { setShowSearch(false); setSearchQ(""); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:400, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:80 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width:"100%", maxWidth:560, background:"#fff", borderRadius:16, boxShadow:"0 24px 64px rgba(0,0,0,.22)", overflow:"hidden" }}>
            {/* Input */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:`1px solid ${BORDER}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={isHQ ? "ค้นหาผู้สนใจ โอกาสการขาย ลูกค้า…" : "ค้นหาผู้สนใจ ลูกค้า ใบเสนอราคา…"}
                style={{ flex:1, border:"none", outline:"none", fontSize:"0.95rem", color:STEEL, background:"transparent" }}/>
              <button onClick={() => { setShowSearch(false); setSearchQ(""); }}
                style={{ fontSize:"0.72rem", color:"#9ca3af", background:"none", border:`1px solid ${BORDER}`, borderRadius:6, padding:"3px 8px", cursor:"pointer" }}>
                Esc
              </button>
            </div>
            {/* Results */}
            {results.length > 0 ? (
              <div style={{ maxHeight:360, overflowY:"auto" }}>
                {results.map((r, i) => {
                  const tc = typeMeta[r.type] ?? { bg:"#f0f0f5", text:"#6b7280", icon:null };
                  const isGroupStart = i === 0 || results[i - 1].type !== r.type;
                  return (
                    <div key={i}>
                    {isGroupStart && (
                      <div style={{ padding:"9px 16px 4px", fontSize:"0.62rem", fontWeight:800, color:"#9ca3af", letterSpacing:"0.05em", background:"#fff" }}>
                        {r.type}
                      </div>
                    )}
                    <button onClick={() => goTo(r.href)}
                      style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"9px 16px",
                        border:"none", borderBottom:`1px solid ${BG}`, background:"#fff", cursor:"pointer", textAlign:"left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                      <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:"50%", background:tc.bg, color:tc.text, flexShrink:0 }}>{tc.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"0.84rem", fontWeight:700, color:STEEL, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.label}</div>
                        <div style={{ fontSize:"0.7rem", color:"#6b7280", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.sub}</div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    </div>
                  );
                })}
              </div>
            ) : q.length >= 2 ? (
              <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"0.82rem", color:"#9ca3af" }}>
                ไม่พบผลลัพธ์สำหรับ &ldquo;{searchQ}&rdquo;
              </div>
            ) : (
              <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:"0.68rem", color:"#9ca3af", fontWeight:700, marginBottom:4, letterSpacing:"0.05em" }}>ค้นหาด่วน</div>
                {(isHQ
                  ? [{ label:"วิเคราะห์ข้อมูล", href:"/reports" }, { label:"ตัวแทนจำหน่าย", href:"/hq/dealers" }, { label:"ผู้สนใจ", href:"/hq/lead-pool" }]
                  : [{ label:"ผู้สนใจทั้งหมด", href:"/leads" }, { label:"ใบเสนอราคา", href:"/quotations" }, { label:"ลูกค้า", href:"/customers" }]
                ).map(s => (
                  <button key={s.href} onClick={() => goTo(s.href)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", border:`1px solid ${BORDER}`, borderRadius:9, background:"#fff", color:STEEL, fontSize:"0.8rem", fontWeight:600, cursor:"pointer", textAlign:"left" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                    <span style={{ color:"#9ca3af" }}>→</span> {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Topbar (ERP look) ───────────────────────────────────── */}
      <header className="erp-topbar">

        <div className="topbar-right">

        {/* Search icon (opens overlay) */}
        <button className="icon-btn" aria-label="ค้นหา"
          onClick={() => { setShowSearch(true); setShowNotifs(false); setShowUser(false); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        {/* Bell + dropdown */}
        <div ref={notifsRef} style={{ position:"relative" }}>
          <button className="icon-btn" aria-label="การแจ้งเตือน"
            onClick={() => { setShowNotifs(p => !p); setShowUser(false); }}>
            <Bell size={18} strokeWidth={2} />
            {unreadCount > 0 && (
              <span style={{
                position:"absolute", top:-2, right:-2, minWidth:16, height:16, padding:"0 4px",
                display:"flex", alignItems:"center", justifyContent:"center",
                borderRadius:99, background:"#dc2626", color:"#fff",
                fontSize:"0.6rem", fontWeight:800, lineHeight:1, border:"2px solid #fff",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications panel */}
          {showNotifs && (
            <div style={{ position:"fixed", top:70, right:24, width:340, background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`, boxShadow:"0 16px 48px rgba(0,0,0,.16)", zIndex:300, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:`1px solid ${BORDER}` }}>
                <span style={{ fontSize:"0.85rem", fontWeight:800, color:STEEL }}>การแจ้งเตือน</span>
                <button onClick={markAll} style={{ fontSize:"0.7rem", color:PRIMARY, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>อ่านทั้งหมด</button>
              </div>
              <div style={{ maxHeight:340, overflowY:"auto" }}>
                {notifs.length === 0 && (
                  <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"0.8rem", color:"#9ca3af" }}>
                    ไม่มีการแจ้งเตือน
                  </div>
                )}
                {notifs.slice(0, 8).map((n, i, shown) => {
                  const isRead = readIds.has(n.id);
                  const isBucketStart = i === 0 || shown[i - 1].bucket !== n.bucket;
                  return (
                    <div key={n.id}>
                    {isBucketStart && (
                      <div style={{ padding:"9px 16px 4px", fontSize:"0.62rem", fontWeight:800, color:"#9ca3af", letterSpacing:"0.05em", background:"#fafafa", borderBottom:`1px solid ${BG}` }}>
                        {BUCKET_LABEL[n.bucket]}
                      </div>
                    )}
                    <button
                      onClick={() => { markOne(n.id); setShowNotifs(false); router.push(n.href); }}
                      style={{ display:"flex", alignItems:"flex-start", gap:10, width:"100%", padding:"11px 16px", border:"none",
                        borderBottom:`1px solid ${BG}`, background:isRead ? "#fff" : "#f6f9ff",
                        cursor:"pointer", textAlign:"left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isRead ? "#fff" : "#f6f9ff"; }}>
                      <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:"50%", background:n.iconBg, color:n.iconColor, flexShrink:0 }}>{n.iconEl}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:"0.78rem", fontWeight:700, color:STEEL }}>{n.title}</span>
                          {!isRead && <span style={{ width:6, height:6, borderRadius:"50%", background:"#dc2626", flexShrink:0 }}/>}
                        </div>
                        <div style={{ fontSize:"0.7rem", color:"#6b7280", lineHeight:1.4 }}>{n.body}</div>
                        <div style={{ fontSize:"0.63rem", color:"#9ca3af", marginTop:3 }}>{n.time}</div>
                      </div>
                    </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:"10px 16px", borderTop:`1px solid ${BORDER}` }}>
                <button onClick={() => { setShowNotifs(false); router.push(isHQ ? "/tasks" : "/activity"); }}
                  style={{ width:"100%", padding:"7px", border:`1px solid ${BORDER}`, borderRadius:9, background:"#fff", color:STEEL, fontSize:"0.75rem", fontWeight:600, cursor:"pointer" }}>
                  {notifs.length > 8 ? `ดูทั้งหมด (${notifs.length}) →` : "ดูทั้งหมด →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User pill + dropdown */}
        <div ref={userRef} style={{ position:"relative" }}>
          <button className="user-chip"
            onClick={() => { setShowUser(p => !p); setShowNotifs(false); }}>
            <div className="avatar avatar-sm" style={{ background:PRIMARY, color:"#fff" }}>
              {initial}
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:"0.76rem", fontWeight:700, color:STEEL, lineHeight:1.2 }}>{session.name}</div>
              <div style={{ fontSize:"0.6rem", color:"#6b7280" }}>{roleLabel}</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft:2, transform: showUser ? "rotate(180deg)" : "none", transition:"transform .15s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {/* User menu */}
          {showUser && (
            <div style={{ position:"fixed", top:70, right:24, width:240, background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`, boxShadow:"0 16px 48px rgba(0,0,0,.16)", zIndex:300, overflow:"hidden" }}>
              {/* Profile header */}
              <div style={{ padding:"14px 16px", borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:PRIMARY, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"1rem", fontWeight:900, color:"#fff", flexShrink:0 }}>
                  {initial}
                </div>
                <div>
                  <div style={{ fontSize:"0.85rem", fontWeight:800, color:STEEL }}>{session.name}</div>
                  <div style={{ fontSize:"0.68rem", color:"#6b7280" }}>{roleLabel}</div>
                  <div style={{ fontSize:"0.63rem", color:"#9ca3af", marginTop:1 }}>{session.dealerName}</div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding:"6px 0" }}>
                {[
                  { Icon: UserCircle, label:"โปรไฟล์", href:"/settings" },
                  { Icon: Settings,    label:"ตั้งค่า",  href:"/settings" },
                ].map(item => (
                  <button key={item.label} onClick={() => { setShowUser(false); router.push(item.href); }}
                    style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 16px", border:"none", background:"none", cursor:"pointer", color:STEEL, fontSize:"0.8rem", fontWeight:600, textAlign:"left" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                    <item.Icon size={15} color="#6b7280" strokeWidth={2} /> {item.label}
                  </button>
                ))}

                {/* Switch role */}
                <div style={{ margin:"6px 12px", padding:"8px 10px", background:BG, borderRadius:9 }}>
                  <div style={{ fontSize:"0.63rem", color:"#9ca3af", fontWeight:700, marginBottom:6, letterSpacing:"0.05em" }}>สลับบทบาท</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {(["dealer","hq"] as const).map(k => (
                      <button key={k} onClick={() => handleSwitch(k)}
                        style={{ flex:1, padding:"5px 0", borderRadius:8, border:"none", cursor:"pointer", fontSize:"0.72rem", fontWeight:700, transition:"all .12s",
                          background: currentKey===k ? PRIMARY : "#fff",
                          color: currentKey===k ? "#fff" : "#6b7280",
                          boxShadow: currentKey===k ? "0 2px 8px rgba(0,0,0,.25)" : "none" }}>
                        {k === "dealer" ? "ดีลเลอร์" : "HQ"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logout */}
              <div style={{ padding:"6px 0 8px", borderTop:`1px solid ${BORDER}` }}>
                <button onClick={handleLogout}
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 16px", border:"none", background:"none", cursor:"pointer", color:"#dc2626", fontSize:"0.8rem", fontWeight:700, textAlign:"left" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fee2e2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                  <span style={{ fontSize:"0.9rem" }}>🚪</span> ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>

        </div>{/* /topbar-right */}
      </header>
    </>
  );
}
