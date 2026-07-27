"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRole } from "@pms/shared/context/RoleContext";
import { useUserProfile } from "@pms/shared/lib/useUserProfile";
import { useSales } from "@pms/shared/context/SalesContext";
import {
  apptTypeLabel,
  notifCategoryOf,
  DEFAULT_HQ_NOTIFS, DEFAULT_HQ_NOTIF_RULES, hqAuditCategory, HQ_ALERT_META,
  type HQNotifRules,
  type LeadRow, type CustomerRow, type QuotationMock, type DealerRow, type AppointmentMock, type UserProfile, type NotifPrefs, type HQNotifChannels,
  type HQAlertKey,
} from "@pms/shared/lib/mock";
import { useRepoValue } from "@pms/shared/lib/useRepoState";
import { useDealerSettings } from "@pms/shared/lib/useDealerSettings";
import { dealers as dealersRepo, settings as settingsRepo } from "@pms/shared/lib/data";
import { Bell, MessageSquare, CheckCircle2, AlertTriangle, UserCircle, Settings, Users, FileText, Sparkles, CalendarClock, LogOut, Menu, Compass, History, UserX, Store, Target, TrendingDown } from "lucide-react";
import { PRIMARY, STEEL } from "@pms/shared/lib/theme";
import { useAuditEntries, type AuditEntry } from "@pms/shared/lib/useAudit";
import { confirmDiscard } from "@pms/shared/lib/useUnsavedGuard";
import { useHQAlerts } from "@pms/shared/lib/useHQAlerts";
import { useHQSearch } from "@pms/shared/lib/useNetworkData";
import { type HQAlert } from "@pms/shared/lib/hqAlerts";
import { useCurrentDealer } from "@pms/shared/lib/useCurrentDealer";

// ── mock "วันนี้" (deterministic) ────────────────────────────────
const MOCK_TODAY = "2026-06-30";

const BORDER   = "#e5e7eb";
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
// ประเภท: ลีดใหม่ · เตือนติดตาม · เตือนประชุม · ใบเสนอราคาใกล้หมดอายุ · ปิดการขายสำเร็จ · เสียโอกาส
// รับ leads/quotations/appointments จาก SalesContext (ข้อมูลสดทั้งหมด)
function buildNotifications(leads: LeadRow[], quotations: QuotationMock[], appointments: AppointmentMock[]): Notif[] {
  const out: Notif[] = [];
  let id = 1;

  const push = (
    n: Omit<Notif, "id" | "bucket"> & { sortDate: string },
  ) => {
    out.push({ ...n, id: id++, bucket: bucketOf(n.sortDate) });
  };

  // 1) ลูกค้าเป้าหมายรอดำเนินการ — leads ขั้น "ติดต่อแล้ว" (WAITING) ที่ยังไม่คืบหน้า
  for (const l of leads.filter(l => l.status === "WAITING")) {
    push({
      iconEl: <MessageSquare size={14} />, iconBg: "#eef2f7", iconColor: "#475569",
      title: "ลูกค้าเป้าหมายรอดำเนินการ",
      body: `${l.company} — ${l.contact} · ${l.province} · ${l.value}`,
      time: `${l.source ?? "ช่องทางออนไลน์"} · ผู้รับผิดชอบ ${l.assigned}`,
      href: `/leads?open=${l.numId}`,
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
      href: `/leads?open=${l.numId}`,
      sortDate: MOCK_TODAY,
    });
  }
  for (const a of appointments.filter(a => a.type === "follow_up" && a.status === "upcoming")) {
    push({
      iconEl: <CalendarClock size={14} />, iconBg: "#fff3cd", iconColor: "#d97706",
      title: "เตือนติดตาม",
      body: `${a.company} — ${a.note}`,
      time: `${a.date} ${a.time} น. · ${a.assigned}`,
      href: "/calendar",
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

  // 5) ปิดการขายสำเร็จ (Deal Won) — quotations status "won"
  for (const qt of quotations.filter(qt => qt.status === "won")) {
    push({
      iconEl: <CheckCircle2 size={14} />, iconBg: "#d1fae5", iconColor: "#059669",
      title: "ปิดการขายสำเร็จ",
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

// ── การแจ้งเตือนฝั่ง HQ = บันทึกการใช้งาน (Audit Log) — HQ เห็นว่าใครทำอะไร ──
const TH_MO_NUM: Record<string, number> = { "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6, "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12 };
function auditISO(at: string): string {
  const m = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(at);
  if (!m || !(m[2] in TH_MO_NUM)) return "";
  return `${+m[3] - 543}-${String(TH_MO_NUM[m[2]]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
}
function buildHQNotifications(entries: AuditEntry[]): Notif[] {
  return entries.map(e => {
    const iso = auditISO(e.at);
    // ของจริงที่เพิ่งเกิด (วันที่จริง ≥ mock วันนี้) จัดเป็น "วันนี้" · seed จัดตามวันที่
    const bucket: NotifBucket = !iso ? "older" : iso >= MOCK_TODAY ? "today" : iso === MOCK_YESTERDAY ? "yesterday" : "older";
    const timeOnly = e.at.split(" · ")[1] ?? e.at;
    return {
      id: e.id,
      iconEl: <History size={14} />, iconBg: "#eef2f7", iconColor: PRIMARY,
      title: e.action,
      body: `${e.user} · ${e.target}`,
      time: `${e.at.split(" · ")[0]} · ${timeOnly}`,
      href: "/hq/audit",
      sortDate: iso || MOCK_TODAY,
      bucket,
    };
  });
}

// ── การแจ้งเตือนตามกฎของ HQ (6 เรื่อง · ตั้งที่ /hq/settings → การแจ้งเตือน) ──
// เนื้อหาคำนวณจากข้อมูลจริงใน @pms/shared/lib/hqAlerts — ที่นี่แค่ใส่ไอคอน/สี
const HQ_ALERT_ICON: Record<HQAlertKey, { el: React.ReactNode; bg: string; color: string }> = {
  unassignedLead: { el: <UserX size={14} />,        bg: "#fdecec", color: "#dc2626" },
  idleLead:       { el: <AlertTriangle size={14} />, bg: "#fff3cd", color: "#d97706" },
  quoteExpiring:  { el: <FileText size={14} />,      bg: "#fff3cd", color: "#d97706" },
  dealerIdle:     { el: <Store size={14} />,         bg: "#eef2f7", color: "#475569" },
  targetAchieved: { el: <Target size={14} />,        bg: "#e5faf0", color: "#059669" },
  lostRate:       { el: <TrendingDown size={14} />,  bg: "#fdecec", color: "#dc2626" },
};
// หน่วยนับของแต่ละกฎ — ใบเสนอราคานับเป็น "ใบ" ที่เหลือนับเป็น "ราย"
const HQ_ALERT_UNIT: Record<HQAlertKey, string> = {
  unassignedLead: "ราย", idleLead: "ราย", quoteExpiring: "ใบ",
  dealerIdle: "ราย", targetAchieved: "ราย", lostRate: "ราย",
};
const ALERT_PREVIEW = 3; // โชว์ 3 บรรทัดแรกพอให้เห็นว่าใคร — ที่เหลือกดขยาย

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
  { match: "/leads",           title: "ลูกค้าเป้าหมาย" },
  { match: "/customers",       title: "ลูกค้า" },
  { match: "/quotations",      title: "ใบเสนอราคา" },
  { match: "/calendar",        title: "ปฏิทิน" },
  { match: "/files",           title: "ไฟล์" },
  { match: "/products",        title: "แม่แบบ" },
  { match: "/settings",        title: "ตั้งค่า" },
  { match: "/profile",         title: "โปรไฟล์" },
  /* HQ */
  { match: "/hq/dashboard",      title: "แดชบอร์ดสำนักงานใหญ่" },
  { match: "/hq/pipeline",       title: "ภาพรวมยอดขาย" },
  { match: "/hq/dealers",        title: "ตัวแทน" },
  { match: "/hq/leads",          title: "ลูกค้าเป้าหมายทั้งเครือ" },
  { match: "/hq/customers",      title: "ลูกค้าทั้งเครือ" },
  { match: "/hq/quotations",     title: "ใบเสนอราคาทั้งเครือ" },
  { match: "/hq/master",         title: "แคตตาล็อกแม่แบบ" },
  { match: "/hq/company",        title: "บริษัท" },
  { match: "/hq/users",          title: "ผู้ใช้งาน" },
  { match: "/hq/audit",          title: "บันทึกการใช้งาน" },
  { match: "/hq/settings",        title: "ตั้งค่า" },
];

function pageTitle(pathname: string): string {
  const hit = [...TITLE_MAP].sort((a, b) => b.match.length - a.match.length).find(t => pathname.startsWith(t.match));
  return hit?.title ?? "แดชบอร์ด";
}

// ── หน้า/เมนูที่ค้นหาได้ทั้งระบบ (แยกตามบทบาท) — keywords รวมคำพ้อง/อังกฤษเพื่อให้ค้นเจอง่าย ──
type PageEntry = { label: string; href: string; keywords: string };
const DEALER_PAGES: PageEntry[] = [
  { label: "แดชบอร์ด",       href: "/dashboard",  keywords: "แดชบอร์ด dashboard หน้าแรก home ภาพรวม สรุป" },
  { label: "ลูกค้าเป้าหมาย", href: "/leads",      keywords: "ลูกค้าเป้าหมาย ลีด lead leads ลูกค้าเป้าหมาย โอกาสการขาย" },
  { label: "ลูกค้า",         href: "/customers",  keywords: "ลูกค้า customer customers" },
  { label: "ใบเสนอราคา",     href: "/quotations", keywords: "ใบเสนอราคา quotation quote เสนอราคา" },
  { label: "แม่แบบ",         href: "/products",   keywords: "แม่แบบ สินค้า product catalog แคตตาล็อก" },
  { label: "ปฏิทิน",         href: "/calendar",   keywords: "ปฏิทิน calendar นัดหมาย นัด appointment" },
  { label: "ไฟล์",           href: "/files",      keywords: "ไฟล์ file files เอกสาร document" },
  { label: "ตั้งค่า",         href: "/settings",   keywords: "ตั้งค่า setting settings config" },
  { label: "บัญชีดีลเลอร์",   href: "/settings",   keywords: "บัญชี account โปรไฟล์ profile ข้อมูลส่วนตัว บริษัท ดีลเลอร์" },
];
const HQ_PAGES: PageEntry[] = [
  { label: "แดชบอร์ดสำนักงานใหญ่", href: "/hq/dashboard",  keywords: "แดชบอร์ด dashboard สำนักงานใหญ่ hq ภาพรวม สรุป หน้าแรก" },
  { label: "ตัวแทน",              href: "/hq/dealers",    keywords: "ตัวแทน dealer dealers จำหน่าย" },
  { label: "ลูกค้าเป้าหมายทั้งเครือ", href: "/hq/leads",   keywords: "ลูกค้าเป้าหมาย lead leads ลีด ทั้งเครือ" },
  { label: "ลูกค้าทั้งเครือ",       href: "/hq/customers",  keywords: "ลูกค้า customer customers ทั้งเครือ" },
  { label: "ภาพรวมยอดขาย",        href: "/hq/pipeline",   keywords: "ภาพรวมยอดขาย pipeline ยอดขาย sales funnel" },
  { label: "ใบเสนอราคาทั้งเครือ",   href: "/hq/quotations", keywords: "ใบเสนอราคา quotation quote ทั้งเครือ" },
  { label: "แคตตาล็อกแม่แบบ",     href: "/hq/master",     keywords: "แคตตาล็อก แม่แบบ master สินค้า product catalog" },
  { label: "บริษัท",              href: "/hq/company",    keywords: "บริษัท company องค์กร โปรไฟล์บริษัท" },
  { label: "ผู้ใช้งาน",            href: "/hq/users",      keywords: "ผู้ใช้งาน user users บัญชีผู้ใช้ สิทธิ์" },
  { label: "ตั้งค่า",              href: "/hq/settings",   keywords: "ตั้งค่า setting settings config" },
  { label: "โปรไฟล์",             href: "/profile",       keywords: "โปรไฟล์ profile บัญชี account ข้อมูลส่วนตัว" },
];

export function Topbar({ onMenu }: { onMenu?: () => void } = {}) {
  const { session, isHQ, logout } = useRole();
  const currentDealer = useCurrentDealer(); // สาขาที่ล็อกอิน — กระดิ่งฝั่งตัวแทน scope ด้วย code นี้
  const router = useRouter();
  const pathname = usePathname();

  // โปรไฟล์ที่ผู้ใช้บันทึกไว้ (/profile) → ชื่อ/รูปบน Topbar อัปเดตทันทีเมื่อบันทึก
  // โปรไฟล์ผ่าน repo — เดิมอ่าน localStorage ต่อสาขา (ผู้ใช้ในสาขาเดียวกันทับกันเอง)
  const { profile } = useUserProfile();


  // ตั้งค่าการแจ้งเตือน (เปิด/ปิดแต่ละชนิด) — อัปเดตทันทีเมื่อบันทึกในหน้าตั้งค่า
  // อ่านผ่าน repo — เดิม loadNotifPrefs() อ่าน localStorage ตรง ๆ
  // (ยังฟัง NOTIF_PREFS_EVENT อยู่ เพราะหน้าตั้งค่ายิง event นี้ตอนกดบันทึก → กระดิ่งอัปเดตทันที)
  const dealerCfg = useDealerSettings();
  const notifPrefs: NotifPrefs | null = dealerCfg.loaded ? dealerCfg.settings.notifPrefs : null;

  // ตั้งค่าการแจ้งเตือนของ HQ (หมวดจาก Audit Log) — กรองกระดิ่งฝั่ง HQ ตาม toggle "ในระบบ"
  // อ่านผ่าน repo — เดิม loadHQNotifPrefs() อ่าน localStorage ของเครื่องที่ใช้
  const hqRules = useRepoValue<HQNotifRules>(() => settingsRepo.getNotifRules(), DEFAULT_HQ_NOTIF_RULES);
  const hqNotifPrefs: Record<string, HQNotifChannels> | null =
    { ...DEFAULT_HQ_NOTIFS, ...(hqRules.channels ?? {}) };

  const displayName = profile?.name || session.name;
  // ชื่อบัญชี = ชื่อเดียวทั้งแอป · ดีลเลอร์ใช้ชื่อบริษัท/ตัวแทน (ไม่ใช่ชื่อคน) · HQ ใช้ชื่อผู้ใช้
  const acctName = isHQ ? displayName : session.dealerName;
  const acctSub = isHQ ? session.dealerName : `ผู้ดูแล: ${displayName}`;
  const avatarUrl = profile?.avatar;
  const initial = acctName.charAt(0).toUpperCase();
  const roleLabel = isHQ ? "ผู้บริหาร HQ"
    : ({ DEALER_ADMIN: "ผู้จัดการตัวแทน", DEALER_SALES: "เซลส์", DEALER_SITE: "เซลส์ภาคสนาม" } as Record<string, string>)[session.role] ?? "สมาชิก";
  // ข้อมูลสดจาก SalesContext → การแจ้งเตือนอัปเดตทันทีเมื่อเพิ่มลีด/ออกใบเสนอราคา/ปิดการขาย
  const { leads: allLeads, quotations: liveQuotations, appointments: liveAppointments, customers: liveCustomers } = useSales();

  // ── ขอบเขตข้อมูลของลีด (สำคัญ) ────────────────────────────────────────────
  // SalesContext ถือลีดของ "ทั้งเครือ" 10 สาขา — ตัวแทนต้องเห็นเฉพาะสมุดงานตัวเอง
  // กติกาเดียวกับ DealerDashboard/หน้า /leads: ไม่มี dealerCode = ลีดที่ตัวแทนสร้างเอง → ของสาขาตัวเอง
  // HQ เห็นทั้งเครือตามปกติ
  //
  // เดิม Topbar ใช้ allLeads ตรง ๆ ทั้งกระดิ่งและช่องค้นหา → ตัวแทน CNX เห็นลีดของ RYG/MST
  // พร้อมชื่อผู้ติดต่อ เบอร์ มูลค่าดีล และชื่อเซลส์สาขาอื่น (ยืนยันด้วยเทสต์: ระยอง/ตาก โผล่ในกระดิ่ง CNX)
  const liveLeads = useMemo(
    () => isHQ ? allLeads : allLeads.filter(l => (l.dealerCode ?? "CNX") === currentDealer.code),
    [allLeads, isHQ, currentDealer.code],
  );
  const auditEntries = useAuditEntries(); // สำหรับ HQ — บันทึกการใช้งาน
  // กฎแจ้งเตือน 6 ข้อของทั้งเครือ — แหล่งเดียวกับการ์ด "ต้องดูด่วน" บนแดชบอร์ด HQ
  const hqAlerts = useHQAlerts();
  // HQ → บันทึกการใช้งาน (ใครทำอะไร) · Dealer → งานขายของตัวเอง
  // กฎแจ้งเตือน 6 ข้อของ HQ ไม่ได้อยู่ในลิสต์นี้ — เป็น "สถานะปัจจุบันของเครือ" ไม่ใช่เหตุการณ์ในอดีต
  // จึงแสดงแยกเป็นกลุ่มไว้บนสุดของแผง (ดู alertGroups) ไม่ปนกับไทม์ไลน์วันนี้/เมื่อวาน
  const notifs = useMemo(() => {
    if (isHQ) {
      const shown = hqNotifPrefs
        ? auditEntries.filter(e => hqNotifPrefs[hqAuditCategory(e.action)]?.inapp !== false)
        : auditEntries;
      return buildHQNotifications(shown);
    }
    const all = buildNotifications(liveLeads, liveQuotations, liveAppointments);
    if (!notifPrefs) return all;
    return all.filter(n => { const c = notifCategoryOf(n.title); return c ? notifPrefs[c] : true; });
  }, [isHQ, auditEntries, liveLeads, liveQuotations, liveAppointments, notifPrefs, hqNotifPrefs]);

  // จัดกลุ่มกฎแจ้งเตือนตามเรื่อง — 28 แถวรวดอ่านไม่ไหว · เรียงตามลำดับใน HQ_ALERT_META
  const alertGroups = useMemo(() => {
    if (!isHQ) return [];
    const m = new Map<HQAlertKey, HQAlert[]>();
    for (const a of hqAlerts) {
      const arr = m.get(a.key);
      if (arr) arr.push(a); else m.set(a.key, [a]);
    }
    return HQ_ALERT_META.filter(meta => m.has(meta.key))
      .map(meta => ({ key: meta.key, title: meta.label, items: m.get(meta.key)! }));
  }, [isHQ, hqAlerts]);

  // ── states ──
  const [showSearch, setShowSearch]     = useState(false);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false); // ขยายดูการแจ้งเตือนทั้งหมดในแผงเดียวกัน
  const [openGroup, setOpenGroup] = useState<HQAlertKey | null>(null); // กลุ่ม "ต้องดูด่วน" ที่กางอยู่
  const [showUser,   setShowUser]       = useState(false);
  const [searchQ,    setSearchQ]        = useState("");
  // ค้นหาฝั่ง HQ — ดึงตรงจาก repo ตามคำค้น (M9 Phase 4) · dealer/local ใช้ array ของ SalesContext เหมือนเดิม
  const hqSearch = useHQSearch(isHQ ? searchQ : "");
  const [readIds,    setReadIds]        = useState<Set<number>>(new Set());

  const notifsRef = useRef<HTMLDivElement>(null);
  const userRef   = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeNotifs = useCallback(() => { setShowNotifs(false); setShowAllNotifs(false); }, []);
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

  // รายชื่อตัวแทนในผลค้นหา — จากทะเบียนจริง ไม่ใช่ชุดตัวอย่าง
  const dealers = useRepoValue<DealerRow[]>(() => dealersRepo.list(), []);

  // ── search results (grouped, ≥2 chars, up to 5 per group) ──
  const q = searchQ.trim().toLowerCase();
  const results: SearchResult[] = useMemo(() => {
    if (q.length < 1) return [];
    const has = (s?: string) => (s ?? "").toLowerCase().includes(q);
    // แหล่งค้นหา: HQ (supabase) = ผลจาก repo ที่ match แล้ว · dealer/local = array ของ SalesContext (สกอปสาขา)
    const srcLeads = hqSearch ? hqSearch.leads : liveLeads;
    const srcCustomers = hqSearch ? hqSearch.customers : liveCustomers;
    const srcQuotations = hqSearch ? hqSearch.quotes : liveQuotations;
    // ลูกค้าไม่มี owner field → หาผู้รับผิดชอบจากลีดที่ผูก customerId เดียวกัน
    const ownerOfCustomer = (cid: number) => srcLeads.find(l => l.customerId === cid)?.assigned;
    return [
      // หน้า/เมนู — ค้นหาได้ทุกหน้าในระบบตามบทบาท (นำทางไปหน้านั้นทันที)
      ...(isHQ ? HQ_PAGES : DEALER_PAGES)
        .filter(p => p.keywords.toLowerCase().includes(q))
        .slice(0, 6)
        .map(p => ({ type: "หน้า", label: p.label, sub: "เปิดหน้านี้", href: p.href })),
      // ลีด — match company/contact/name/phone/ผู้รับผิดชอบ
      ...srcLeads
        .filter((l: LeadRow) => has(l.name) || has(l.company) || has(l.contact) || has(l.phone) || has(l.assigned))
        .slice(0, 5)
        .map((l: LeadRow) => {
          // แสดง secondary text ตามสิ่งที่ตรงกัน (เบอร์โทร / ผู้รับผิดชอบ)
          const sub = has(l.phone)
            ? `${l.contact} · ${l.phone ?? ""}`
            : has(l.assigned)
            ? `${l.contact} · ผู้รับผิดชอบ ${l.assigned}`
            : `${l.contact} · ${l.province} · ${l.value}`;
          return { type: "ลูกค้าเป้าหมาย", label: l.company, sub, href: `/leads?open=${l.numId}` };
        }),
      // ลูกค้า — match company/name/province/phone/ผู้รับผิดชอบ (ผ่านลีดที่ผูกกัน)
      ...srcCustomers
        .filter((c: CustomerRow) => has(c.company) || has(c.name) || has(c.province) || has(c.phone) || has(ownerOfCustomer(c.id)))
        .slice(0, 5)
        .map((c: CustomerRow) => {
          const owner = ownerOfCustomer(c.id);
          const sub = has(c.phone)
            ? `${c.name} · ${c.phone}`
            : has(owner)
            ? `${c.name} · ผู้รับผิดชอบ ${owner}`
            : `${c.name} · ${c.province}`;
          return { type: "ลูกค้า", label: c.company, sub, href: `/customers?open=${c.id}` };
        }),
      // ใบเสนอราคา — match id (เลขที่ใบเสนอราคา)/customer/project
      ...srcQuotations
        .filter((qt: QuotationMock) => has(qt.id) || has(qt.customer) || has(qt.project))
        .slice(0, 5)
        .map((qt: QuotationMock) => ({ type: "ใบเสนอราคา", label: qt.id, sub: `${qt.customer} · ${qt.total}`, href: "/quotations" })),
      // ตัวแทนจำหน่าย — เฉพาะ role HQ (dealer ไม่มีสิทธิ์เข้าหน้า /hq)
      ...(isHQ ? dealers
        .filter((d: DealerRow) => has(d.name) || has(d.code) || has(d.region))
        .slice(0, 5)
        .map((d: DealerRow) => ({ type: "ตัวแทน", label: d.name, sub: `${d.code} · ${d.region}`, href: `/hq/dealers/${d.code}` })) : []),
    ];
  }, [q, dealers, liveLeads, liveCustomers, liveQuotations, isHQ, hqSearch]);

  // งานค้างของเครือนับเข้าตัวเลขบนกระดิ่งด้วย — "อ่านแล้ว" กดปิดไม่ได้ เพราะงานยังไม่ได้ถูกจัดการจริง
  const alertCount = alertGroups.reduce((s, g) => s + g.items.length, 0);
  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length + alertCount;

  function markAll() { setReadIds(new Set(notifs.map(n => n.id))); }
  function markOne(id: number) { setReadIds(prev => new Set([...prev, id])); }

  // ทุกทางที่พาออกจากหน้าปัจจุบันต้องผ่าน confirmDiscard() ก่อน — หน้าที่มีฟอร์มค้าง (ตั้งค่า)
  // จะได้เตือนครบทุกทาง ไม่ใช่เตือนเฉพาะตอนสลับแท็บ (ดู @pms/shared/lib/useUnsavedGuard)
  function handleLogout() {
    if (!confirmDiscard()) return;
    setShowUser(false);
    logout();
    router.push("/login");
  }

  function goTo(href: string) {
    if (!confirmDiscard()) return;
    setShowSearch(false);
    setSearchQ("");
    router.push(href);
    // แจ้งหน้าปลายทางให้เปิดเรคคอร์ดที่ค้นเจอ แม้ผู้ใช้อยู่หน้าเดิมอยู่แล้ว
    // (router.push ไปเส้นทางเดิมด้วย query ต่างกัน จะไม่ remount → effect ?open ไม่ทำงาน)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bpms:open-record", { detail: href }));
    }
  }

  // ── type badge color + icon per group ──
  const typeMeta: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    "หน้า":           { bg: "#eef2f7", text: PRIMARY,   icon: <Compass size={14} /> },
    "ลูกค้าเป้าหมาย":  { bg: "#dce5f0", text: PRIMARY,   icon: <MessageSquare size={14} /> },
    "ลูกค้า":         { bg: "#e5faf0", text: "#059669", icon: <Users size={14} /> },
    "ใบเสนอราคา":     { bg: "#fef3cd", text: "#b45309", icon: <FileText size={14} /> },
    "ตัวแทน":  { bg: "#e8eaed", text: STEEL, icon: <Sparkles size={14} /> },
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
                placeholder={isHQ ? "ค้นหาหน้า ลูกค้าเป้าหมาย ตัวแทน ใบเสนอราคา…" : "ค้นหาหน้า ลูกค้าเป้าหมาย ลูกค้า ใบเสนอราคา…"}
                style={{ flex:1, border:"none", outline:"none", fontSize:"0.92rem", color:STEEL, background:"transparent" }}/>
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
                      <div style={{ padding:"9px 16px 4px", fontSize:"0.65rem", fontWeight:800, color:"#9ca3af", letterSpacing:"0.05em", background:"#fff" }}>
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
                        <div style={{ fontSize:"0.86rem", fontWeight:700, color:STEEL, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.label}</div>
                        <div style={{ fontSize:"0.72rem", color:"#6b7280", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.sub}</div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    </div>
                  );
                })}
              </div>
            ) : q.length >= 1 ? (
              <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"0.8rem", color:"#9ca3af" }}>
                ไม่พบผลลัพธ์สำหรับ &ldquo;{searchQ}&rdquo;
              </div>
            ) : (
              <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"0.8rem", color:"#9ca3af" }}>
                พิมพ์เพื่อค้นหา
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Topbar (ERP look) ───────────────────────────────────── */}
      <header className="erp-topbar">

        {/* ปุ่มเมนู (มือถือ) */}
        <button className="hamburger" onClick={onMenu} aria-label="เปิดเมนู">
          <Menu size={20} />
        </button>

        {/* ชื่อหน้า — แหล่งเดียวของหัวหน้า (ทุกหน้าอยู่แถวนี้ ไม่มีหัวซ้ำในเนื้อหา) */}
        <h1 className="topbar-title">{pageTitle(pathname)}</h1>

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
            onClick={() => { setShowNotifs(p => !p); setShowAllNotifs(false); setShowUser(false); }}>
            <Bell size={18} strokeWidth={2} />
            {unreadCount > 0 && (
              <span style={{
                position:"absolute", top:-2, right:-2, minWidth:16, height:16, padding:"0 4px",
                display:"flex", alignItems:"center", justifyContent:"center",
                borderRadius:99, background:"#dc2626", color:"#fff",
                fontSize:"0.65rem", fontWeight:800, lineHeight:1, border:"2px solid #fff",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications panel */}
          {/* แผงการแจ้งเตือน — 380px: รายการใน "ต้องดูด่วน" ยาว (ชื่อลูกค้า + จำนวนวัน + ผู้รับผิดชอบ)
              340px เดิมตัดบรรทัดเกือบทุกใบ · maxWidth กันล้นจอแคบ */}
          {showNotifs && (
            <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:380, maxWidth:"calc(100vw - 24px)", background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`, boxShadow:"0 16px 48px rgba(0,0,0,.16)", zIndex:300, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:`1px solid ${BORDER}` }}>
                <span style={{ fontSize:"0.86rem", fontWeight:800, color:STEEL }}>การแจ้งเตือน</span>
                <button onClick={markAll} style={{ fontSize:"0.72rem", color:PRIMARY, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>อ่านทั้งหมด</button>
              </div>
              <div style={{ maxHeight:400, overflowY:"auto" }}>
                {/* ── ต้องดูด่วน — กฎแจ้งเตือนของ HQ จัดกลุ่มตามเรื่อง ──
                    สถานะปัจจุบันของเครือ ไม่ใช่เหตุการณ์ในอดีต จึงไม่มีจุด "อ่านแล้ว" และไม่เข้าบัคเก็ตวันนี้/เมื่อวาน
                    (เรื่องจะหายเองเมื่อตัวแทนไปจัดการจริง — กด "อ่านแล้ว" ไม่ได้ทำให้งานเสร็จ) */}
                {alertGroups.length > 0 && (
                  <div style={{ borderBottom:`1px solid ${BORDER}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px 5px", background:"#fafafa", borderBottom:`1px solid ${BG}` }}>
                      <span style={{ fontSize:"0.65rem", fontWeight:800, color:"#9ca3af", letterSpacing:"0.05em" }}>ต้องดูด่วน</span>
                      <span style={{ fontSize:"0.6rem", fontWeight:800, color:"#dc2626", background:"#fdecec", borderRadius:99, padding:"1px 6px", fontVariantNumeric:"tabular-nums" }}>{alertCount}</span>
                    </div>
                    {alertGroups.map(g => {
                      const ic = HQ_ALERT_ICON[g.key];
                      const expanded = openGroup === g.key;
                      const shown = expanded ? g.items : g.items.slice(0, ALERT_PREVIEW);
                      return (
                        <div key={g.key} style={{ padding:"9px 16px", borderBottom:`1px solid ${BG}` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:8, background:ic.bg, color:ic.color, flexShrink:0 }}>{ic.el}</span>
                            <span style={{ flex:1, minWidth:0, fontSize:"0.78rem", fontWeight:700, color:STEEL }}>{g.title}</span>
                            <span style={{ fontSize:"0.9rem", fontWeight:800, color:ic.color, fontVariantNumeric:"tabular-nums" }}>{g.items.length}</span>
                            <span style={{ fontSize:"0.62rem", color:"#9ca3af" }}>{HQ_ALERT_UNIT[g.key]}</span>
                          </div>
                          <div style={{ marginLeft:34, marginTop:3, display:"flex", flexDirection:"column" }}>
                            {shown.map((a, i) => (
                              <button key={`${a.href}-${i}`}
                                onClick={() => { if (!confirmDiscard()) return; setShowNotifs(false); router.push(a.href); }}
                                style={{ display:"block", width:"100%", padding:"3px 0", border:"none", background:"none", cursor:"pointer", textAlign:"left",
                                  fontSize:"0.68rem", color:"#6b7280", lineHeight:1.45 }}>
                                {a.body}
                              </button>
                            ))}
                            {g.items.length > ALERT_PREVIEW && (
                              <button onClick={() => setOpenGroup(expanded ? null : g.key)}
                                style={{ alignSelf:"flex-start", marginTop:2, padding:0, border:"none", background:"none", cursor:"pointer", fontSize:"0.64rem", fontWeight:700, color:PRIMARY }}>
                                {expanded ? "ย่อ" : `ดูอีก ${g.items.length - ALERT_PREVIEW} รายการ`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {notifs.length === 0 && alertGroups.length === 0 && (
                  <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"0.8rem", color:"#9ca3af" }}>
                    ไม่มีการแจ้งเตือน
                  </div>
                )}
                {(showAllNotifs ? notifs : notifs.slice(0, 8)).map((n, i, shown) => {
                  const isRead = readIds.has(n.id);
                  const isBucketStart = i === 0 || shown[i - 1].bucket !== n.bucket;
                  return (
                    <div key={n.id}>
                    {isBucketStart && (
                      <div style={{ padding:"9px 16px 4px", fontSize:"0.65rem", fontWeight:800, color:"#9ca3af", letterSpacing:"0.05em", background:"#fafafa", borderBottom:`1px solid ${BG}` }}>
                        {BUCKET_LABEL[n.bucket]}
                      </div>
                    )}
                    <button
                      onClick={() => { if (!confirmDiscard()) return; markOne(n.id); setShowNotifs(false); router.push(n.href); }}
                      style={{ display:"flex", alignItems:"flex-start", gap:10, width:"100%", padding:"11px 16px", border:"none",
                        borderBottom:`1px solid ${BG}`, background:isRead ? "#fff" : "#f6f9ff",
                        cursor:"pointer", textAlign:"left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isRead ? "#fff" : "#f6f9ff"; }}>
                      <span style={{ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:"50%", background:n.iconBg, color:n.iconColor, flexShrink:0 }}>{n.iconEl}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:"0.8rem", fontWeight:700, color:STEEL }}>{n.title}</span>
                          {!isRead && <span style={{ width:6, height:6, borderRadius:"50%", background:"#dc2626", flexShrink:0 }}/>}
                        </div>
                        <div style={{ fontSize:"0.72rem", color:"#6b7280", lineHeight:1.4 }}>{n.body}</div>
                        <div style={{ fontSize:"0.65rem", color:"#9ca3af", marginTop:3 }}>{n.time}</div>
                      </div>
                    </button>
                    </div>
                  );
                })}
              </div>
              {notifs.length > 8 && (
                <div style={{ padding:"10px 16px", borderTop:`1px solid ${BORDER}` }}>
                  {isHQ ? (
                    <button onClick={() => { if (!confirmDiscard()) return; setShowNotifs(false); router.push("/hq/audit"); }}
                      style={{ width:"100%", padding:"7px", border:`1px solid ${BORDER}`, borderRadius:9, background:"#fff", color:PRIMARY, fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>
                      ดูบันทึกการใช้งานทั้งหมด →
                    </button>
                  ) : (
                    <button onClick={() => setShowAllNotifs(v => !v)}
                      style={{ width:"100%", padding:"7px", border:`1px solid ${BORDER}`, borderRadius:9, background:"#fff", color:STEEL, fontSize:"0.72rem", fontWeight:600, cursor:"pointer" }}>
                      {showAllNotifs ? "แสดงน้อยลง" : `ดูทั้งหมด (${notifs.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User pill + dropdown */}
        <div ref={userRef} style={{ position:"relative" }}>
          <button className="user-chip"
            onClick={() => { setShowUser(p => !p); setShowNotifs(false); }}>
            {avatarUrl
              ? <img className="avatar avatar-sm" src={avatarUrl} alt="" style={{ objectFit:"cover" }} />
              : <div className="avatar avatar-sm" style={{ background:PRIMARY, color:"#fff" }}>{initial}</div>}
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:"0.72rem", fontWeight:700, color:STEEL, lineHeight:1.2 }}>{acctName}</div>
              <div style={{ fontSize:"0.65rem", color:"#6b7280" }}>{roleLabel}</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft:2, transform: showUser ? "rotate(180deg)" : "none", transition:"transform .15s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {/* User menu */}
          {showUser && (
            <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:240, background:"#fff", borderRadius:14, border:`1px solid ${BORDER}`, boxShadow:"0 16px 48px rgba(0,0,0,.16)", zIndex:300, overflow:"hidden" }}>
              {/* Profile header */}
              <div style={{ padding:"14px 16px", borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", gap:10 }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <div style={{ width:40, height:40, borderRadius:"50%", background:PRIMARY, display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"1rem", fontWeight:900, color:"#fff", flexShrink:0 }}>
                      {initial}
                    </div>}
                <div>
                  <div style={{ fontSize:"0.86rem", fontWeight:800, color:STEEL }}>{acctName}</div>
                  <div style={{ fontSize:"0.65rem", color:"#6b7280" }}>{roleLabel}</div>
                  <div style={{ fontSize:"0.65rem", color:"#9ca3af", marginTop:1 }}>{acctSub}</div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding:"6px 0" }}>
                {[
                  // ตัวแทน: บัญชีดีลเลอร์รวมอยู่ในหน้า "ตั้งค่า" แล้ว → ไม่ต้องมีเมนูซ้ำ · HQ ยังมี "โปรไฟล์" (/profile) แยก
                  ...(isHQ ? [{ Icon: UserCircle, label: "โปรไฟล์", href: "/profile" }] : []),
                  { Icon: Settings,    label:"ตั้งค่า",  href: isHQ ? "/hq/settings" : "/settings" },
                ].map(item => (
                  <button key={item.label} onClick={() => { if (!confirmDiscard()) return; setShowUser(false); router.push(item.href); }}
                    style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 16px", border:"none", background:"none", cursor:"pointer", color:STEEL, fontSize:"0.8rem", fontWeight:600, textAlign:"left" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                    <item.Icon size={15} color="#6b7280" strokeWidth={2} /> {item.label}
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div style={{ padding:"6px 0 8px", borderTop:`1px solid ${BORDER}` }}>
                <button onClick={handleLogout}
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 16px", border:"none", background:"none", cursor:"pointer", color:"#dc2626", fontSize:"0.8rem", fontWeight:700, textAlign:"left" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fee2e2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                  <LogOut size={15} strokeWidth={2} /> ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>

        </div>{/* /topbar-right */}
      </header>

      {/* แถวปุ่มเฉพาะหน้า — อยู่ใต้แถบบน ชิดขวา (ช่วงวันที่ · Export · เพิ่ม · รีเฟรช) · หน้าไหนไม่มี = ซ่อน */}
      <div className="topbar-actionbar">
        <div id="topbar-slot" className="topbar-slot" />
      </div>
    </>
  );
}
