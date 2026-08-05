"use client";

// LocalAdapter — ห่อ loader / localStorage เดิม (mock.ts, useAudit.ts) โดยไม่แก้ของเดิม
// เป็น adapter เริ่มต้น (NEXT_PUBLIC_DATA_SOURCE=local) · พฤติกรรมเท่าเดิม แค่รวมเข้าท่อเดียว
import {
  loadHQDealers, HQ_DEALERS_KEY,
  loadMasterCatalog, MASTER_CATALOG_KEY, MASTER_CATALOG_EVENT,
  loadDealerFiles, saveDealerFiles, addDealerFile, removeDealerFile,
  loadResponsiblePersons, RP_STORAGE_KEY,
  loadHQPolicy, loadHQTargets, loadHQNotifRules, loadLostReasons, HQ_JOURNEY_KEY,
  HQ_POLICY_KEY, HQ_TARGETS_KEY, HQ_NOTIF_RULES_KEY, HQ_SETTINGS_EVENT,
  loadDealerLeadRulesMap, saveDealerLeadRules, loadQuoteValidityDays,
  leads as leadSeed, initialCustomers, quotations as quoteSeed, appointments as apptSeed,
} from "@pms/shared/lib/mock";
// อ่านจาก auditStore (localStorage ล้วน) ไม่ใช่ useAudit — useAudit เป็น React hook ที่ import
// ชั้นข้อมูลกลับเข้ามา ทำให้เกิดวงจร import จริงตอนรัน (ดูเหตุผลเต็มใน auditStore.ts)
import { loadAudit, appendAudit } from "@pms/shared/lib/auditStore";
import { exactKey } from "@pms/shared/lib/customerMatch";
import { parseThaiDate as parseThaiDateLocal } from "@pms/shared/lib/leadMetrics";
import { parseBaht } from "@pms/shared/lib/format";
import { profileKey, PROFILE_UPDATED_EVENT, sessions, QUOTED_UP, DEFAULT_DEALER_CODE,
  DEFAULT_LEAD_RULES, DEFAULT_HQ_NOTIF_RULES, DEFAULT_HQ_POLICY, DEFAULT_DELIVERY_DAYS, mainTemplateOf, type UserProfile } from "@pms/shared/lib/mock";

// โหมด local ไม่มี session จริง — อ่านรหัสสาขาจากคีย์ที่ RoleContext เก็บไว้ (คีย์เดิมของแอป)
function currentDealerCode(): string {
  if (typeof window === "undefined") return "";
  try {
    const s = localStorage.getItem("pms_session_v2");
    if (s) return (JSON.parse(s) as { dealerCode?: string }).dealerCode ?? "";
  } catch {}
  return "";
}
function fireProfile() {
  try { window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT)); } catch {}
}
import type { DataAdapter } from "../ports";
import type { LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope, DealerSettings, HQCompany, CustomerNote, SystemUser } from "../types";

const HQ_COMPANY_KEY = "hq_company_profile";
const NOTES_KEY = "customer_notes_v1";
const HQ_USERS_KEY = "hq_users_v4";
const EMPTY_HQ_COMPANY: HQCompany = { name: "", address: "", taxId: "", phone: "", email: "", website: "" };
import { DEFAULT_ISSUER, DEFAULT_NOTIF_PREFS, ISSUER_KEY, NOTIF_PREFS_KEY } from "@pms/shared/lib/mock";
import { DEFAULT_DOC, DOC_KEY, WORDMARK_KEY } from "@pms/shared/lib/quotationPrint";

// โลโก้ไอคอนบนแถบเมนู — คีย์เดิมของหน้าตั้งค่าตัวแทน
const LOGO_KEY = "dealer_company_logo_v2";

const ok = <T>(v: T): Promise<T> => Promise.resolve(v);
const done = (): Promise<void> => Promise.resolve();

function writeKey(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function readKey<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; } catch {}
  return fallback;
}

// คีย์งานขาย — สะท้อนของ SalesContext (Step 1 จะย้ายการเขียนมาที่นี่)
const SALES = {
  leads: "sales_leads_v2",
  quotations: "sales_quotations_v1",
  customers: "sales_customers_v1",
  appointments: "sales_appointments_v1",
} as const;

// กรองตามสาขา (multi-tenant) — dealer เห็นเฉพาะสาขาตัวเอง · HQ เห็นทั้งหมด
// แถวไม่ระบุ dealerCode = สมุดงานเดิมของ CNX (ห้าม default เป็น scope.dealerCode ไม่งั้นไม่ติดสาขา
// จะรั่วโผล่ทุกสาขา — คู่แฝดฝั่งอ่านของบั๊ก branch-isolation)
// แจ้งหน้าอื่นใน origin เดียวกันว่าค่าตั้งค่าระดับเครือเปลี่ยน (โหมด supabase ใช้ Realtime แทน)
function fireSettings() {
  try { window.dispatchEvent(new Event(HQ_SETTINGS_EVENT)); } catch {}
}

function scopeByDealer<T extends { dealerCode?: string }>(list: T[], scope?: Scope): T[] {
  if (!scope || scope.isHQ || !scope.dealerCode) return list;
  return list.filter(r => (r.dealerCode ?? DEFAULT_DEALER_CODE) === scope.dealerCode);
}

// "วันหมดอายุ" ของใบเสนอราคา — นิยามเดียวที่ใช้ทั้ง expireOverdue และ hqAlerts (expiring)
//   ใบที่กรอก expiry เอง (รูปแบบ YYYY-MM-DD) → ใช้ค่านั้น
//   ไม่ได้กรอก (ค่าเริ่มต้นฟอร์ม = ว่าง) → date สร้างใบ + validityDays (นโยบาย HQ)
//   คืน null ถ้าคำนวณไม่ได้เลย (ทั้ง expiry และ date ใช้ไม่ได้)
function effectiveExpiryOf(q: { expiry?: string; date: string }, validityDays: number): string | null {
  if (q.expiry && /^\d{4}-\d{2}-\d{2}$/.test(q.expiry)) return q.expiry;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(q.date || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setDate(d.getDate() + validityDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const LocalAdapter: DataAdapter = {
  // โหมด local ไม่มี Storage — เก็บแค่ metadata (คืน null ให้หน้าจอรู้ว่าไม่มีไฟล์จริงให้โหลด)
  storage: {
    upload: () => ok(null),
    signedUrl: () => ok(null),
    remove: () => done(),
  },
  // โหมด local ไม่มี Realtime — ข้อมูลอยู่ในเครื่องเดียว (ข้ามแท็บใช้ event bus/storage event เหมือนเดิม)
  // (หน้าจอฝั่ง local ใช้ event/storage ของ origin ตัวเองแทน — ดู useMasterCatalog)
  realtime: { subscribeSales: () => () => {}, subscribeCatalog: () => () => {}, subscribeSettings: () => () => {}, subscribeNotes: () => () => {}, subscribeDealerSettings: () => () => {} },
  dealers: {
    list: () => ok(loadHQDealers()),
    save: (all) => { writeKey(HQ_DEALERS_KEY, all); return done(); },
    remove: (code) => { writeKey(HQ_DEALERS_KEY, loadHQDealers().filter(d => d.code !== code)); return done(); },
  },
  catalog: {
    list: () => ok(loadMasterCatalog()),
    // บันทึกแล้วยิง event → หน้าอื่น (origin เดียวกัน) ที่ใช้ useMasterCatalog โหลดใหม่ทันที
    save: (all) => {
      writeKey(MASTER_CATALOG_KEY, all);
      try { window.dispatchEvent(new Event(MASTER_CATALOG_EVENT)); } catch {}
      return done();
    },
    remove: (id) => {
      writeKey(MASTER_CATALOG_KEY, loadMasterCatalog().filter(p => p.id !== id));
      try { window.dispatchEvent(new Event(MASTER_CATALOG_EVENT)); } catch {}
      return done();
    },
  },
  files: {
    list: (scope) => ok(scopeByDealer(loadDealerFiles(), scope)),
    add: (f) => ok(addDealerFile(f)),
    update: (f) => { saveDealerFiles(loadDealerFiles().map(x => x.id === f.id ? f : x)); return done(); },
    remove: (id) => { removeDealerFile(id); return done(); },
  },
  persons: {
    list: (scope) => ok(scopeByDealer(loadResponsiblePersons(), scope)),
    // แทนที่เฉพาะพนักงานของสาขานี้ (คงของสาขาอื่นไว้) + ตรา dealerCode ให้ทุกคน
    save: (all, dealerCode) => {
      const others = loadResponsiblePersons().filter(p => (p.dealerCode ?? DEFAULT_DEALER_CODE) !== dealerCode);
      const mine = all.map(p => ({ ...p, dealerCode }));
      writeKey(RP_STORAGE_KEY, [...others, ...mine]);
      return done();
    },
  },
  settings: {
    getPolicy: () => ok(loadHQPolicy()),
    getTargets: () => ok(loadHQTargets()),
    getNotifRules: () => ok(loadHQNotifRules()),
    getLeadRulesMap: () => ok(loadDealerLeadRulesMap()),
    saveLeadRules: (code, rules) => { saveDealerLeadRules(code, rules); return done(); },
    getQuoteValidityDays: () => ok(loadQuoteValidityDays()),
    getLostReasons: () => ok(loadLostReasons()),
    // เก็บรูปเดิม { lost: [...] } เพื่อไม่ให้ค่าที่ HQ เคยตั้งไว้หายไป
    saveLostReasons: (lost) => { writeKey(HQ_JOURNEY_KEY, { lost }); fireSettings(); return done(); },
    // ยิง event หลังบันทึก → หน้าอื่น (origin เดียวกัน) ที่ใช้ค่านโยบาย/เป้า อัปเดตทันที
    savePolicy: (p) => { writeKey(HQ_POLICY_KEY, p); fireSettings(); return done(); },
    saveTargets: (t) => { writeKey(HQ_TARGETS_KEY, t); fireSettings(); return done(); },
    saveNotifRules: (r) => { writeKey(HQ_NOTIF_RULES_KEY, r); fireSettings(); return done(); },
    // mirror restore_hq_settings ฝั่ง supabase (0093) — เธรดเดียวในเบราว์เซอร์ = เขียนทีละกลุ่มได้โดยไม่มี
    // ทางเสี่ยง partial-write จริง (ไม่มี network round-trip คั่นระหว่างแต่ละคีย์)
    restoreSettings: (patch) => {
      if (patch.policy)      writeKey(HQ_POLICY_KEY, patch.policy);
      if (patch.targets)     writeKey(HQ_TARGETS_KEY, patch.targets);
      if (patch.notifRules)  writeKey(HQ_NOTIF_RULES_KEY, patch.notifRules);
      if (patch.lostReasons) writeKey(HQ_JOURNEY_KEY, { lost: patch.lostReasons });
      if (patch.company)     writeKey(HQ_COMPANY_KEY, patch.company);
      fireSettings();
      return done();
    },
  },
  // ตั้งค่าของสาขา — โหมด local เก็บ 4 คีย์เดิมไว้เหมือนเดิม (ค่าที่ผู้ใช้เคยตั้งไม่หาย)
  // ไม่แยกตามสาขา เพราะเครื่องหนึ่งใช้สาขาเดียวอยู่แล้วในโหมดเดโม
  dealerSettings: {
    get: () => ok<DealerSettings>({
      issuer: readKey(ISSUER_KEY, DEFAULT_ISSUER),
      document: { ...DEFAULT_DOC, ...readKey(DOC_KEY, DEFAULT_DOC) },
      wordmark: readKey<string>(WORDMARK_KEY, ""),
      logo: readKey<string>(LOGO_KEY, ""),
      notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...readKey(NOTIF_PREFS_KEY, DEFAULT_NOTIF_PREFS) },
    }),
    save: (_dealerCode, patch) => {
      if (patch.issuer)     writeKey(ISSUER_KEY, patch.issuer);
      if (patch.document)   writeKey(DOC_KEY, patch.document);
      if (patch.wordmark !== undefined) writeKey(WORDMARK_KEY, patch.wordmark);
      if (patch.logo !== undefined)     writeKey(LOGO_KEY, patch.logo);
      if (patch.notifPrefs) writeKey(NOTIF_PREFS_KEY, patch.notifPrefs);
      return done();
    },
  },
  // โหมด local: คีย์เดิมต่อสาขา (พฤติกรรมเท่าเดิม ค่าที่เคยตั้งไม่หาย)
  profile: {
    get: () => ok(readKey<UserProfile | null>(profileKey(currentDealerCode()), null)),
    save: (p) => { writeKey(profileKey(currentDealerCode()), p); fireProfile(); return done(); },
  },
  // ข้อมูลบริษัท HQ — โหมด local ใช้คีย์เดิม (ค่าที่เคยตั้งไม่หาย)
  hqCompany: {
    get: () => ok(readKey<HQCompany>(HQ_COMPANY_KEY, EMPTY_HQ_COMPANY)),
    save: (c) => { writeKey(HQ_COMPANY_KEY, c); fireSettings(); return done(); },
  },
  // โน้ตลูกค้า — โหมด local เก็บเป็นอาร์เรย์เดียวในเครื่อง (เดิมไม่มีที่เก็บเลย)
  notes: {
    list: (scope) => ok(scopeByDealer(readKey<CustomerNote[]>(NOTES_KEY, []), scope)),
    create: (n) => {
      const all = readKey<CustomerNote[]>(NOTES_KEY, []);
      const row = { ...n, id: all.reduce((m, x) => Math.max(m, x.id), 0) + 1 } as CustomerNote;
      writeKey(NOTES_KEY, [row, ...all]);
      return ok(row);
    },
    update: (n) => {
      writeKey(NOTES_KEY, readKey<CustomerNote[]>(NOTES_KEY, []).map(x => x.id === n.id ? n : x));
      return ok(n);
    },
    remove: (id) => {
      writeKey(NOTES_KEY, readKey<CustomerNote[]>(NOTES_KEY, []).filter(x => x.id !== id));
      return done();
    },
  },
  // โหมดเดโม: รายชื่ออยู่ในเครื่อง สร้าง/ลบได้ (ไม่มีระบบยืนยันตัวตนจริงให้ผูก)
  users: {
    // โหมดเดโม: ผู้ใช้ที่ "ล็อกอินได้จริง" คือบัญชีเดโมใน sessions — ไม่ใช่รายชื่อที่กุขึ้นมา
    // (ผู้ใช้ที่เพิ่มจากหน้าจอเก็บทับลงคีย์เดิม)
    list: () => {
      const saved = readKey<SystemUser[]>(HQ_USERS_KEY, []);
      if (saved.length) return ok(saved);
      const demo: SystemUser[] = Object.entries(sessions)
        .filter(([, v]) => !v.dealerCode)
        .map(([key, v]) => ({
          id: `demo-${key}`, name: v.name, email: "", phone: "",
          role: v.role, department: "", dealerCode: "",
          status: "active" as const, createdAt: "", avatar: undefined,
        }));
      return ok(demo);
    },
    update: (u) => {
      const all = readKey<SystemUser[]>(HQ_USERS_KEY, []);
      writeKey(HQ_USERS_KEY, all.map(x => x.id === u.id ? { ...x, ...u } : x));
      return done();
    },
    canCreate: () => true,
  },
  audit: {
    // local: loadAudit เพดาน MAX=300 อยู่แล้ว · เคารพ limit เพื่อพฤติกรรมตรงกับ supabase (M8)
    list: (limit) => ok(limit ? loadAudit().slice(0, limit) : loadAudit()),
    append: (e) => { appendAudit(e); return done(); },
  },

  // rollup รายสาขา (M9 Phase 1) — คำนวณจาก array ใน localStorage (live-only, ทั้งหมด = มุมมอง HQ)
  // สูตรตรงกับ SQL dealer_rollup + useDealerPerformance เป๊ะ (parity):
  //   หมายเหตุ: โหมด local, useDealerPerformance ยังใช้เส้นทางคำนวณ client เดิม (ผสม seed สาขาอื่น)
  //   ตัวนี้จึงไว้ให้พอร์ตครบ/คนอื่นเรียกได้ — คิดเฉพาะข้อมูล live (ไม่รวม seed)
  metrics: {
    dealerRollup: (year, opts) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const ls = readKey<LeadRow[]>(SALES.leads, leadSeed);
      const m = new Map<string, { quotes: number; won: number; lost: number; revenue: number; openLeads: number; staleLeads: number }>();
      const get = (code: string) => {
        let r = m.get(code);
        if (!r) { r = { quotes: 0, won: 0, lost: 0, revenue: 0, openLeads: 0, staleLeads: 0 }; m.set(code, r); }
        return r;
      };
      const asOfMs = opts ? Date.parse(opts.asOf) : Date.parse("2026-06-30");
      const defDays = opts?.defaultDays ?? DEFAULT_LEAD_RULES.followUpAlertDays;
      for (const q of qs) {
        const r = get(q.dealerCode ?? DEFAULT_DEALER_CODE);
        r.quotes += 1;
        if (q.status === "won") {
          r.won += 1;
          // ปีของ date แบบ literal (ตรงกับ fmtISOToThai→parseThaiDate ที่ client ใช้)
          const yr = /^(\d{4})-\d{2}-\d{2}/.exec(q.date || "")?.[1];
          if (yr && Number(yr) === year) r.revenue += q.totalValue ?? 0;
        }
        if (q.status === "lost") r.lost += 1;
      }
      for (const l of ls) {
        if (l.status === "PAID" || l.status === "CANCELLED") continue;
        const code = l.dealerCode ?? DEFAULT_DEALER_CODE;
        const r = get(code); r.openLeads += 1;
        // stale = needsFollowUp: วันติดต่อล่าสุด (max activities ?? createdAt) เงียบเกินเกณฑ์
        const actMs = (l.activities ?? []).map(a => parseThaiDateLocal(a.date)?.getTime()).filter((x): x is number => x != null);
        const lastMs = actMs.length ? Math.max(...actMs) : parseThaiDateLocal(l.createdAt ?? "")?.getTime() ?? null;
        if (lastMs != null) {
          const days = Math.floor((asOfMs - lastMs) / 86_400_000);
          const thr = opts?.perDealer?.[code] ?? defDays;
          if (days > thr) r.staleLeads += 1;
        }
      }
      return ok(m);
    },
    leadSummary: (f) => {
      const ls = readKey<LeadRow[]>(SALES.leads, leadSeed);
      const search = (f.search ?? "").trim().toLowerCase();
      const isoOf = (l: LeadRow) => { const d = parseThaiDateLocal(l.createdAt ?? ""); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null; };
      const rows = ls.filter(l => {
        const iso = isoOf(l);
        if (iso && f.dateStart && iso < f.dateStart) return false;
        if (iso && f.dateEnd && iso > f.dateEnd) return false;
        if (f.dealerCodes?.length && !f.dealerCodes.includes(l.dealerCode ?? DEFAULT_DEALER_CODE)) return false;
        if (f.province && l.province !== f.province) return false;
        if (f.product && l.product !== f.product) return false;
        if (f.source && (l.source || "ไม่ระบุ") !== f.source) return false;
        if (f.status && l.status !== f.status) return false;
        if (search && !`${l.company ?? ""} ${l.contact ?? ""} ${l.province ?? ""} ${l.product ?? ""} ${l.assigned ?? ""} ${l.id ?? ""} ${l.dealerCode ?? ""}`.toLowerCase().includes(search)) return false;
        return true;
      });
      const cnt = <K extends string>(key: (l: LeadRow) => K) => { const m = new Map<K, number>(); rows.forEach(l => m.set(key(l), (m.get(key(l)) ?? 0) + 1)); return m; };
      const statusM = cnt(l => l.status);
      const statusValM = new Map<string, number>();
      rows.forEach(l => statusValM.set(l.status, (statusValM.get(l.status) ?? 0) + parseBaht(l.value)));
      const sourceM = cnt(l => (l.source || "ไม่ระบุ"));
      const productM = cnt(l => (l.product || "ไม่ระบุ"));
      const provM = new Map<string, number>();
      rows.forEach(l => { const p = (l.province ?? "").trim(); if (p) provM.set(p, (provM.get(p) ?? 0) + 1); });
      const lostM = new Map<string, { count: number; value: number }>();
      rows.filter(l => l.status === "CANCELLED" && l.lostReason).forEach(l => { const r = lostM.get(l.lostReason!) ?? { count: 0, value: 0 }; r.count += 1; r.value += parseBaht(l.value); lostM.set(l.lostReason!, r); });
      const monthM = new Map<string, { y: number; m: number; created: number; won: number; lost: number }>();
      rows.forEach(l => { const d = parseThaiDateLocal(l.createdAt ?? ""); if (!d) return; const y = d.getFullYear(), m = d.getMonth(), k = `${y}-${m}`; let r = monthM.get(k); if (!r) { r = { y, m, created: 0, won: 0, lost: 0 }; monthM.set(k, r); } r.created++; if (l.status === "PAID") r.won++; if (l.status === "CANCELLED") r.lost++; });
      const dealerM = new Map<string, { leads: number; quoted: number }>();
      rows.forEach(l => { const code = l.dealerCode ?? DEFAULT_DEALER_CODE; let r = dealerM.get(code); if (!r) { r = { leads: 0, quoted: 0 }; dealerM.set(code, r); } r.leads++; if (QUOTED_UP.includes(l.status)) r.quoted++; });
      return ok({
        byStatus: [...statusM.entries()].map(([status, count]) => ({ status, count, value: statusValM.get(status) ?? 0 })),
        bySource: [...sourceM.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
        byProduct: [...productM.entries()].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count),
        byProvince: [...provM.entries()].map(([province, count]) => ({ province, count })).sort((a, b) => a.province.localeCompare(b.province)),
        byLostReason: [...lostM.entries()].map(([reason, x]) => ({ reason, ...x })).sort((a, b) => b.count - a.count),
        byMonth: [...monthM.values()],
        byDealer: [...dealerM.entries()].map(([dealerCode, x]) => ({ dealerCode, ...x })),
      });
    },
    networkQuoteRange: (start, end, dealer) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const m = new Map<string, { quotes: number; won: number; lost: number; wonVal: number; quoteVal: number }>();
      for (const q of qs) {
        const md = /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "");
        if (!md) continue;
        const d = md[1];
        if (d < start || d > end) continue; // ISO string เทียบตามลำดับ = เทียบวันได้ตรง
        const code = q.dealerCode ?? DEFAULT_DEALER_CODE;
        if (dealer && code !== dealer) continue;
        let r = m.get(code);
        if (!r) { r = { quotes: 0, won: 0, lost: 0, wonVal: 0, quoteVal: 0 }; m.set(code, r); }
        const v = q.totalValue ?? 0;
        r.quotes += 1; r.quoteVal += v;
        if (q.status === "won") { r.won += 1; r.wonVal += v; }
        if (q.status === "lost") r.lost += 1;
      }
      return ok(m);
    },
    dashboardQuoteSummary: (start, end, dealer) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const monthM = new Map<string, { y: number; m: number; quotes: number; won: number; lost: number; wonVal: number }>();
      const statusM = new Map<string, { count: number; value: number }>();
      const prodM = new Map<string | null, { value: number; projects: number }>();
      for (const q of qs) {
        const md = /^(\d{4})-(\d{2})-(\d{2})/.exec(q.date || "");
        if (!md) continue;
        const dstr = `${md[1]}-${md[2]}-${md[3]}`;
        if (dstr < start || dstr > end) continue;
        const code = q.dealerCode ?? DEFAULT_DEALER_CODE;
        if (dealer && code !== dealer) continue;
        const v = q.totalValue ?? 0;
        const y = Number(md[1]), m = Number(md[2]) - 1; // 0..11 ให้ตรง getMonth()
        const mk = `${y}-${m}`;
        let mm = monthM.get(mk);
        if (!mm) { mm = { y, m, quotes: 0, won: 0, lost: 0, wonVal: 0 }; monthM.set(mk, mm); }
        mm.quotes += 1;
        if (q.status === "won") { mm.won += 1; mm.wonVal += v; }
        if (q.status === "lost") mm.lost += 1;
        let sm = statusM.get(q.status);
        if (!sm) { sm = { count: 0, value: 0 }; statusM.set(q.status, sm); }
        sm.count += 1; sm.value += v;
        const raw = q.buildingType || q.project; // productLine = buildingType || project
        const product = raw ? raw : null;         // ว่าง/undefined → null (ตรงกับ nullif ใน SQL)
        let pm = prodM.get(product);
        if (!pm) { pm = { value: 0, projects: 0 }; prodM.set(product, pm); }
        pm.value += v; pm.projects += 1;
      }
      return ok({
        byMonth: [...monthM.values()],
        byStatus: [...statusM.entries()].map(([status, x]) => ({ status, ...x })),
        byProduct: [...prodM.entries()].map(([product, x]) => ({ product, ...x })).sort((a, b) => b.value - a.value),
      });
    },
    networkCustomerSummary: () => {
      const cs = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      const provM = new Map<string, { revenue: number; count: number }>();
      for (const c of cs) {
        const p = (c.province ?? "").trim() || "ไม่ระบุ";
        let r = provM.get(p);
        if (!r) { r = { revenue: 0, count: 0 }; provM.set(p, r); }
        r.revenue += c.totalValue || 0; r.count += 1;
      }
      return ok({
        total: cs.length,
        byProvince: [...provM.entries()].map(([province, x]) => ({ province, ...x })).sort((a, b) => b.revenue - a.revenue),
      });
    },
    unassignedLeads: (f) => {
      const ls = readKey<LeadRow[]>(SALES.leads, leadSeed);
      const asOf = f.asOf ? new Date(f.asOf) : new Date(2026, 5, 30);
      const search = (f.search ?? "").trim().toLowerCase();
      const rows = ls.filter(l => {
        if (l.assigned?.trim()) return false;
        if (l.status === "PAID" || l.status === "CANCELLED") return false; // isLeadOpen
        const d = parseThaiDateLocal(l.createdAt ?? ""); if (!d) return false;
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (f.dateStart && iso < f.dateStart) return false;
        if (f.dateEnd && iso > f.dateEnd) return false;
        const code = l.dealerCode ?? DEFAULT_DEALER_CODE;
        if (f.dealerCodes?.length && !f.dealerCodes.includes(code)) return false;
        if (f.province && l.province !== f.province) return false;
        if (f.product && l.product !== f.product) return false;
        if (f.source && (l.source || "ไม่ระบุ") !== f.source) return false;
        if (search && !`${l.company ?? ""} ${l.contact ?? ""} ${l.province ?? ""} ${l.product ?? ""} ${l.id ?? ""} ${code}`.toLowerCase().includes(search)) return false;
        const hours = f.perDealer?.[code] ?? f.defaultHours ?? DEFAULT_LEAD_RULES.unassignedAlertHours;
        return (asOf.getTime() - d.getTime()) / 3_600_000 > hours;
      });
      const m = new Map<string, number>();
      rows.forEach(l => { const c = l.dealerCode ?? DEFAULT_DEALER_CODE; m.set(c, (m.get(c) ?? 0) + 1); });
      return ok({ total: rows.length, byDealer: [...m.entries()].map(([dealerCode, count]) => ({ dealerCode, count })).sort((a, b) => b.count - a.count) });
    },
    hqAlerts: (f) => {
      const ls = readKey<LeadRow[]>(SALES.leads, leadSeed);
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const asOf = f.asOf ? new Date(f.asOf) : new Date(2026, 5, 30);
      const DAY = 86_400_000;
      const isOpen = (s: string) => s !== "PAID" && s !== "CANCELLED";
      const lastContactOf = (l: LeadRow) => {
        const ds = (l.activities ?? []).map(a => parseThaiDateLocal(a.date)).filter((d): d is Date => !!d);
        const created = parseThaiDateLocal(l.createdAt ?? "");
        return ds.length ? new Date(Math.max(...ds.map(d => d.getTime()))) : created;
      };
      // คำนวณวันที่แค่ครั้งเดียวต่อลีด (เดิม parse/lastContactOf ซ้ำ 2 รอบใน filter+map แล้วใช้ ! ยืนยันว่าไม่ null
      //   ทั้งที่ map เป็นคนละ pass จาก filter — พึ่ง purity ของฟังก์ชันเฉย ๆ ไม่ได้การันตีจาก type)
      const unassigned = ls
        .filter(l => !l.assigned?.trim() && isOpen(l.status))
        .map(l => ({ l, created: parseThaiDateLocal(l.createdAt ?? "") }))
        .filter((x): x is { l: LeadRow; created: Date } => !!x.created
          && (asOf.getTime() - x.created.getTime()) / 3_600_000 > (f.unassignedPerDealer?.[x.l.dealerCode ?? DEFAULT_DEALER_CODE] ?? f.unassignedDefaultHours ?? DEFAULT_LEAD_RULES.unassignedAlertHours))
        .map(({ l }) => ({ numId: l.numId, company: l.company || l.name, province: l.province, value: l.value }));
      const idle = ls
        .filter(l => isOpen(l.status))
        .map(l => ({ l, lc: lastContactOf(l) }))
        .filter((x): x is { l: LeadRow; lc: Date } => !!x.lc && (asOf.getTime() - x.lc.getTime()) / DAY > (f.leadIdleDays ?? DEFAULT_HQ_NOTIF_RULES.leadIdleDays))
        .map(({ l, lc }) => ({ numId: l.numId, company: l.company || l.name, assigned: l.assigned, idleDays: Math.floor((asOf.getTime() - lc.getTime()) / DAY) }));
      const validity = f.quoteValidityDays ?? DEFAULT_HQ_POLICY.quoteValidityDays, within = f.quoteExpiringDays ?? DEFAULT_HQ_NOTIF_RULES.quoteExpiringDays;
      // นิยามเดียวกับ expireOverdue (effectiveExpiryOf) — เดิมใช้ date+validity เสมอ ไม่สนใจ expiry ที่กรอกเอง
      //   ใบที่ตั้ง expiry เองไว้ไกลจากวันนี้ ก็ยังโดนเตือน "ใกล้หมดอายุ" ผิด ๆ ตาม date+validity
      const expiring = qs.filter(q => q.status === "sent_to_client").map(q => {
        const eff = effectiveExpiryOf(q, validity); if (!eff) return null;
        const daysLeft = Math.round((new Date(eff + "T00:00:00").getTime() - asOf.getTime()) / DAY);
        return daysLeft >= 0 && daysLeft <= within ? { quoteNo: q.id, customer: q.customer, value: q.totalValue ?? 0, dealerCode: q.dealerCode ?? null, daysLeft } : null;
      }).filter((x): x is NonNullable<typeof x> => !!x);
      const latestM = new Map<string, number>();
      qs.forEach(q => { if (!q.dealerCode) return; const d = /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "")?.[1]; if (!d) return; const t = new Date(d).getTime(); if (!latestM.has(q.dealerCode) || t > latestM.get(q.dealerCode)!) latestM.set(q.dealerCode, t); });
      const dealerLatest = [...latestM.entries()].map(([dealerCode, t]) => ({ dealerCode, idleDays: Math.floor((asOf.getTime() - t) / DAY) }));
      const lostM = new Map<string, { lost: number; closed: number }>();
      ls.forEach(l => { if (!l.dealerCode || isOpen(l.status)) return; const r = lostM.get(l.dealerCode) ?? { lost: 0, closed: 0 }; if (l.status === "CANCELLED") r.lost++; r.closed++; lostM.set(l.dealerCode, r); });
      const lostRate = [...lostM.entries()].map(([dealerCode, x]) => ({ dealerCode, ...x }));
      return ok({ unassigned, idle, expiring, dealerLatest, lostRate });
    },
    hqQuotationsSummary: (f) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const asOfMs = Date.parse(f.asOf ?? "2026-06-30");
      const search = (f.search ?? "").trim().toLowerCase();
      const plOf = (q: QuotationMock): string | null => { const bt = (q.buildingType ?? "").trim(); return bt ? bt : (q.project ?? null); };
      const dateOf = (q: QuotationMock) => /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "")?.[1];
      const dM = new Map<string, { count: number; value: number; sent: number; won: number; lost: number; wonVal: number; latest: string | null }>();
      const mM = new Map<string, { y: number; m: number; quotes: number; won: number; lost: number; wonVal: number }>();
      const pM = new Map<string | null, { value: number; projects: number }>();
      const agM = new Map<string, { count: number; value: number }>();
      for (const q of qs) {
        const d = dateOf(q); if (!d) continue;
        if (f.status && q.status !== f.status) continue;
        if (f.dealerCodes?.length && !f.dealerCodes.includes(q.dealerCode ?? DEFAULT_DEALER_CODE)) continue;
        const pl = plOf(q);
        if (f.productLines?.length && (pl == null || !f.productLines.includes(pl))) continue;
        if (f.dateStart && d < f.dateStart) continue;
        if (f.dateEnd && d > f.dateEnd) continue;
        if (search && !`${q.id} ${q.customer ?? ""}`.toLowerCase().includes(search) && !f.searchDealers?.includes(q.dealerCode ?? DEFAULT_DEALER_CODE)) continue;
        const code = q.dealerCode ?? DEFAULT_DEALER_CODE, v = q.totalValue ?? 0;
        const y = Number(d.slice(0, 4)), mo = Number(d.slice(5, 7)) - 1;
        let dr = dM.get(code); if (!dr) { dr = { count: 0, value: 0, sent: 0, won: 0, lost: 0, wonVal: 0, latest: null as string | null }; dM.set(code, dr); }
        dr.count++; dr.value += v; if (q.status !== "draft") dr.sent++;
        if (q.status === "won") { dr.won++; dr.wonVal += v; } if (q.status === "lost") dr.lost++;
        if (!dr.latest || d > dr.latest) dr.latest = d; // วันใบล่าสุด (ISO)
        const mk = `${y}-${mo}`; let mr = mM.get(mk); if (!mr) { mr = { y, m: mo, quotes: 0, won: 0, lost: 0, wonVal: 0 }; mM.set(mk, mr); }
        mr.quotes++; if (q.status === "won") { mr.won++; mr.wonVal += v; } if (q.status === "lost") mr.lost++;
        let pr = pM.get(pl); if (!pr) { pr = { value: 0, projects: 0 }; pM.set(pl, pr); } pr.value += v; pr.projects++;
        if (q.status === "sent_to_client") {
          const days = Math.max(0, Math.round((asOfMs - Date.parse(d)) / 86_400_000));
          const bucket = days <= 7 ? "0-7" : days <= 14 ? "8-14" : days <= 30 ? "15-30" : "30+";
          let ar = agM.get(bucket); if (!ar) { ar = { count: 0, value: 0 }; agM.set(bucket, ar); } ar.count++; ar.value += v;
        }
      }
      return ok({
        byDealer: [...dM.entries()].map(([dealerCode, x]) => ({ dealerCode, ...x })).sort((a, b) => b.value - a.value),
        byMonth: [...mM.values()],
        byProduct: [...pM.entries()].map(([product, x]) => ({ product, ...x })).sort((a, b) => b.value - a.value),
        aging: [...agM.entries()].map(([bucket, x]) => ({ bucket, ...x })),
      });
    },
    // หน้าเดียวของฐานข้อมูลลูกค้า HQ + KPI/กราฟ จากทั้งชุดที่กรองแล้ว — mirror ตรรกะ SQL ใน migration 0080
    hqCustomersPage: (opts) => {
      const custs = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      const quotes = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const dealerNameOf = new Map(loadHQDealers().map(d => [d.code, d.name]));

      type Agg = { buildingTypes: Set<string>; templates: Set<string>; deliveredAt: string | null; lastPurchaseAt: string | null; count: number; deliveryYears: Set<number> };
      const aggByCustomer = new Map<number, Agg>();
      for (const q of quotes) {
        if (q.status !== "won" || !q.customerId) continue;
        const wonDate = /^\d{4}-\d{2}-\d{2}/.exec(q.date || "")?.[0];
        if (!wonDate) continue;
        const main = mainTemplateOf(q.buildingType) || q.buildingType || "";
        if (!main) continue;
        let a = aggByCustomer.get(q.customerId);
        if (!a) { a = { buildingTypes: new Set(), templates: new Set(), deliveredAt: null, lastPurchaseAt: null, count: 0, deliveryYears: new Set() }; aggByCustomer.set(q.customerId, a); }
        a.buildingTypes.add(main);
        if (main !== q.buildingType) a.templates.add(q.buildingType);
        const deliveredD = new Date(wonDate); deliveredD.setDate(deliveredD.getDate() + DEFAULT_DELIVERY_DAYS);
        const deliveredIso = deliveredD.toISOString().slice(0, 10);
        if (!a.deliveredAt || deliveredIso > a.deliveredAt) a.deliveredAt = deliveredIso;
        if (!a.lastPurchaseAt || wonDate > a.lastPurchaseAt) a.lastPurchaseAt = wonDate;
        a.count++;
        a.deliveryYears.add(deliveredD.getFullYear() + 543);
      }

      const search = (opts.search ?? "").trim().toLowerCase();
      const base = custs.map(c => {
        const a = aggByCustomer.get(c.id);
        return {
          id: c.id, name: c.company, dealerCode: c.dealerCode ?? DEFAULT_DEALER_CODE,
          dealerName: dealerNameOf.get(c.dealerCode ?? DEFAULT_DEALER_CODE) ?? (c.dealerCode ?? DEFAULT_DEALER_CODE),
          province: c.province ?? "", totalValue: c.totalValue ?? 0,
          buildingTypes: a ? [...a.buildingTypes] : [], templates: a ? [...a.templates] : [],
          deliveredAt: a?.deliveredAt ?? null, lastPurchaseAt: a?.lastPurchaseAt ?? null,
          isRepeat: (a?.count ?? 0) > 1, deliveryYears: a ? [...a.deliveryYears] : [],
        };
      }).filter(c => {
        if (search && !c.name.toLowerCase().includes(search) && !c.province.toLowerCase().includes(search)) return false;
        if (opts.dealerCode && c.dealerCode !== opts.dealerCode) return false;
        if (opts.provinces?.length && !opts.provinces.includes(c.province)) return false;
        if (opts.buildingType && !c.buildingTypes.includes(opts.buildingType)) return false;
        if (opts.deliveryYear && !c.deliveryYears.includes(opts.deliveryYear)) return false;
        return true;
      });

      const total = base.length;
      const kpi = {
        total,
        active: base.filter(c => c.buildingTypes.length > 0).length,
        revenue: base.reduce((s, c) => s + c.totalValue, 0),
        repeat: base.filter(c => c.isRepeat).length,
      };
      const countBy = (keysOf: (c: typeof base[number]) => string[]) => {
        const m = new Map<string, number>();
        base.forEach(c => keysOf(c).forEach(k => m.set(k, (m.get(k) ?? 0) + 1)));
        return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      };
      const byDealerMap = new Map<string, { name: string; value: number }>();
      const revByDealerMap = new Map<string, number>();
      base.forEach(c => {
        const bd = byDealerMap.get(c.dealerCode) ?? { name: c.dealerName, value: 0 }; bd.value++; byDealerMap.set(c.dealerCode, bd);
        revByDealerMap.set(c.dealerCode, (revByDealerMap.get(c.dealerCode) ?? 0) + c.totalValue);
      });
      const charts = {
        byType: countBy(c => c.buildingTypes),
        bySubtype: countBy(c => c.templates),
        byProvince: countBy(c => c.province ? [c.province] : []).slice(0, 10),
        byDealer: [...byDealerMap.entries()].map(([code, x]) => ({ code, name: x.name, value: x.value })).sort((a, b) => b.value - a.value),
        revenueByDealer: [...revByDealerMap.entries()].map(([code, revenue]) => ({ code, revenue })).sort((a, b) => b.revenue - a.revenue),
      };
      const sorted = [...base].sort((a, b) => b.totalValue - a.totalValue || a.id - b.id);
      const rows = sorted.slice(opts.offset, opts.offset + opts.limit).map(c => ({
        id: c.id, name: c.name, dealerCode: c.dealerCode, dealerName: c.dealerName, province: c.province,
        totalValue: c.totalValue, buildingTypes: c.buildingTypes, templates: c.templates,
        deliveredAt: c.deliveredAt, lastPurchaseAt: c.lastPurchaseAt,
      }));
      return ok({ total, kpi, charts, rows });
    },
    hqCustomersFilterOptions: () => {
      const custs = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      const quotes = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const dealerNameOf = new Map(loadHQDealers().map(d => [d.code, d.name]));
      const dealers = new Map<string, string>();
      custs.forEach(c => { const code = c.dealerCode ?? DEFAULT_DEALER_CODE; dealers.set(code, dealerNameOf.get(code) ?? code); });
      const provinces = new Set<string>();
      custs.forEach(c => { if (c.province) provinces.add(c.province); });
      const types = new Set<string>();
      const years = new Set<number>();
      quotes.forEach(q => {
        if (q.status !== "won" || !q.customerId) return;
        const wonDate = /^\d{4}-\d{2}-\d{2}/.exec(q.date || "")?.[0];
        if (!wonDate) return;
        const main = mainTemplateOf(q.buildingType) || q.buildingType || "";
        if (main) types.add(main);
        const d = new Date(wonDate); d.setDate(d.getDate() + DEFAULT_DELIVERY_DAYS);
        years.add(d.getFullYear() + 543);
      });
      return ok({
        dealers: [...dealers.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
        provinces: [...provinces].sort((a, b) => a.localeCompare(b, "th")),
        types: [...types].sort((a, b) => a.localeCompare(b, "th")),
        years: [...years].sort((a, b) => b - a),
      });
    },
  },

  // งานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) · เขียนลง localStorage คีย์เดียวกับ SalesContext
  leads: {
    list: (scope) => ok(scopeByDealer(readKey<LeadRow[]>(SALES.leads, leadSeed), scope)),
    // หน้าเดียว + กรอง (M9 Phase 4) — mirror leads_page ฝั่ง DB
    listPage: (scope, opts) => {
      const search = (opts.search ?? "").trim().toLowerCase();
      const isoOf = (l: LeadRow) => { const d = parseThaiDateLocal(l.createdAt ?? ""); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null; };
      const lastMs = (l: LeadRow) => { const a = (l.activities ?? []).map(x => parseThaiDateLocal(x.date)?.getTime()).filter((x): x is number => x != null); return a.length ? Math.max(...a) : (parseThaiDateLocal(l.createdAt ?? "")?.getTime() ?? null); };
      const asOfMs = Date.parse(opts.asOf ?? "2026-06-30"), defDays = opts.defaultDays ?? DEFAULT_LEAD_RULES.followUpAlertDays;
      let arr = scopeByDealer(readKey<LeadRow[]>(SALES.leads, leadSeed), scope).filter(l => {
        const iso = isoOf(l);
        if (iso && opts.dateStart && iso < opts.dateStart) return false;
        if (iso && opts.dateEnd && iso > opts.dateEnd) return false;
        if (opts.status && l.status !== opts.status) return false;
        if (opts.dealerCodes?.length && !opts.dealerCodes.includes(l.dealerCode ?? DEFAULT_DEALER_CODE)) return false;
        if (opts.province && l.province !== opts.province) return false;
        if (opts.product && l.product !== opts.product) return false;
        if (opts.source && (l.source || "ไม่ระบุ") !== opts.source) return false;
        if (search && !`${l.company ?? ""} ${l.contact ?? ""} ${l.province ?? ""} ${l.product ?? ""} ${l.assigned ?? ""} ${l.id ?? ""} ${l.dealerCode ?? ""}`.toLowerCase().includes(search)) return false;
        if (opts.overdue) {
          if (l.status === "PAID" || l.status === "CANCELLED") return false;
          const lm = lastMs(l); if (lm == null) return false;
          const thr = opts.perDealer?.[l.dealerCode ?? DEFAULT_DEALER_CODE] ?? defDays;
          if (!(Math.floor((asOfMs - lm) / 86_400_000) > thr)) return false;
        }
        return true;
      });
      arr = [...arr].sort((a, b) => {
        const am = parseThaiDateLocal(a.createdAt ?? "")?.getTime() ?? -Infinity, bm = parseThaiDateLocal(b.createdAt ?? "")?.getTime() ?? -Infinity;
        return am !== bm ? bm - am : (b.numId ?? 0) - (a.numId ?? 0);
      });
      return ok({ rows: arr.slice(opts.offset, opts.offset + opts.limit), total: arr.length });
    },
    // num_id ถัดไป — โหมด local เครื่องเดียว → max+1 ของสาขานั้นพอ (supabase ใช้ RPC atomic)
    nextNumId: (dealerCode) => {
      const mine = scopeByDealer(readKey<LeadRow[]>(SALES.leads, leadSeed), { dealerCode, isHQ: false });
      return ok(mine.reduce((m, l) => Math.max(m, l.numId), 0) + 1);
    },
    create: (row) => {
      const list = readKey<LeadRow[]>(SALES.leads, leadSeed);
      writeKey(SALES.leads, [row, ...list]);
      return ok(row);
    },
    update: (row) => {
      const list = readKey<LeadRow[]>(SALES.leads, leadSeed);
      writeKey(SALES.leads, list.map((l) => (l.id === row.id ? row : l)));
      return ok(row);
    },
    remove: (id) => {
      const list = readKey<LeadRow[]>(SALES.leads, leadSeed);
      writeKey(SALES.leads, list.filter((l) => l.id !== id));
      return done();
    },
    setStatus: (id, status) => {
      const list = readKey<LeadRow[]>(SALES.leads, leadSeed);
      writeKey(SALES.leads, list.map((l) => (l.id === id ? { ...l, status } : l)));
      return done();
    },
  },
  quotations: {
    list: (scope) => ok(scopeByDealer(readKey<QuotationMock[]>(SALES.quotations, quoteSeed), scope)),
    // หน้าเดียว + กรอง/เรียง (M9 Phase 2) — mirror ตรรกะ supabase เป๊ะ
    listPage: (scope, opts) => {
      const s = (opts.search ?? "").trim().toLowerCase();
      const dateOf = (q: QuotationMock) => /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "")?.[1];
      const plOf = (q: QuotationMock) => { const bt = (q.buildingType ?? "").trim(); return bt ? bt : (q.project ?? undefined); };
      let arr = scopeByDealer(readKey<QuotationMock[]>(SALES.quotations, quoteSeed), scope).filter(q => {
        if (opts.status && q.status !== opts.status) return false;
        if (opts.dealerCodes?.length && !opts.dealerCodes.includes(q.dealerCode ?? DEFAULT_DEALER_CODE)) return false;
        if (opts.productLines?.length) { const pl = plOf(q); if (pl === undefined || !opts.productLines.includes(pl)) return false; }
        const d = dateOf(q);
        if (opts.dateStart && (!d || d < opts.dateStart)) return false;
        if (opts.dateEnd && (!d || d > opts.dateEnd)) return false;
        if (s && !`${q.id} ${q.customer ?? ""}`.toLowerCase().includes(s) && !opts.searchDealers?.includes(q.dealerCode ?? DEFAULT_DEALER_CODE)) return false;
        return true;
      });
      const col = opts.sort?.col ?? "date", asc = (opts.sort?.dir ?? "desc") === "asc";
      arr = [...arr].sort((a, b) => {
        let c: number;
        if (col === "total_value") c = (a.totalValue ?? 0) - (b.totalValue ?? 0);
        else c = String((a as unknown as Record<string, unknown>)[col] ?? "").localeCompare(String((b as unknown as Record<string, unknown>)[col] ?? ""));
        c = asc ? c : -c;
        if (c === 0) return String(a.id).localeCompare(String(b.id)); // secondary = id "ขึ้นเสมอ" (ตรง supabase order("id"))
        return c;
      });
      return ok({ rows: arr.slice(opts.offset, opts.offset + opts.limit), total: arr.length });
    },
    create: (row) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      writeKey(SALES.quotations, [row, ...list]);
      return ok(row);
    },
    // เซฟตี้เน็ตชั้นที่ 2 (mirror quotations_won_requires_customer, 0069/0071) — โหมด local ไม่มี DB
    // constraint คุมให้ ถ้าไม่เช็คตรงนี้ ฟอร์มแก้ไขทั่วไป (ที่ตอนนี้ตัดตัวเลือก "won" ออกแล้วก็จริง)
    // หรือโค้ดเส้นทางอื่นในอนาคตจะเขียน won โดยไม่มีลูกค้าผูกได้แบบเงียบๆ (พบจากผลตรวจสอบ 31 ก.ค. 69)
    update: (row) => {
      if (row.status === "won" && !((row.customerId ?? 0) > 0)) {
        return Promise.reject(new Error('ปิดการขายสำเร็จไม่ได้ — ใบนี้ยังไม่ได้ผูกกับลูกค้า (ใช้ปุ่ม "ลูกค้าตอบรับ ✓" แทน)'));
      }
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      writeKey(SALES.quotations, list.map((q) => (q.id === row.id ? row : q)));
      return ok(row);
    },
    remove: (id) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      writeKey(SALES.quotations, list.filter((q) => q.id !== id));
      return done();
    },
    setStatus: (id, status) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      if (status === "won" && !((list.find(q => q.id === id)?.customerId ?? 0) > 0)) {
        return Promise.reject(new Error('ปิดการขายสำเร็จไม่ได้ — ใบนี้ยังไม่ได้ผูกกับลูกค้า (ใช้ปุ่ม "ลูกค้าตอบรับ ✓" แทน)'));
      }
      writeKey(SALES.quotations, list.map((q) => (q.id === id ? { ...q, status } : q)));
      return done();
    },
    // เหมือน setStatus + reconcileWonTotal รวมกัน (0102) — เธรดเดียวในเบราว์เซอร์ไม่มี race จริงอยู่แล้ว
    // แต่คงพฤติกรรม/ลายเซ็นเดียวกับ Supabase ไว้เพื่อ parity
    setStatusReconciled: (id, status) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const target = list.find(q => q.id === id);
      if (status === "won" && !((target?.customerId ?? 0) > 0)) {
        return Promise.reject(new Error('ปิดการขายสำเร็จไม่ได้ — ใบนี้ยังไม่ได้ผูกกับลูกค้า (ใช้ปุ่ม "ลูกค้าตอบรับ ✓" แทน)'));
      }
      const nextQuotes = list.map((q) => (q.id === id ? { ...q, status } : q));
      writeKey(SALES.quotations, nextQuotes);
      const updatedQuote = nextQuotes.find(q => q.id === id)!;
      let updatedCustomer: CustomerRow | null = null;
      if (updatedQuote.customerId && updatedQuote.customerId > 0) {
        const custs = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
        const wonTotal = nextQuotes.filter(q => q.customerId === updatedQuote.customerId && q.status === "won").reduce((s, q) => s + (q.totalValue ?? 0), 0);
        const nextCusts = custs.map(c => c.id === updatedQuote.customerId ? { ...c, totalValue: wonTotal } : c);
        writeKey(SALES.customers, nextCusts);
        updatedCustomer = nextCusts.find(c => c.id === updatedQuote.customerId) ?? null;
      }
      return Promise.resolve({ quotation: updatedQuote, customer: updatedCustomer });
    },
    // ปิดใบที่เลยวันหมดอายุ (โหมด local ทำกับชุดของสาขานั้น)
    //   "หมดอายุ" = expiry ที่กรอกเอง ถ้ามี · ไม่กรอก (ค่าเริ่มต้นฟอร์ม) = date + validityDays (นโยบาย HQ)
    //   เดิมอ่านแต่ expiry → ใบที่ไม่ได้กรอก expiry (ส่วนใหญ่) ไม่มีวันหมดอายุเองเลย ไม่ตรงกับที่ hq_alerts เตือน
    expireOverdue: (asOf, scope, validityDays = 30) => {
      const all = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      let n = 0;
      const next = all.map(q => {
        const mine = !scope || scope.isHQ || !scope.dealerCode || (q.dealerCode ?? DEFAULT_DEALER_CODE) === scope.dealerCode;
        const effectiveExpiry = effectiveExpiryOf(q, validityDays);
        const overdue = q.status === "sent_to_client" && !!effectiveExpiry && effectiveExpiry < asOf;
        if (mine && overdue) { n++; return { ...q, status: "expired" as const }; }
        return q;
      });
      if (n) writeKey(SALES.quotations, next);
      return ok(n);
    },
    salesperson: (quoteId) => {
      const q = readKey<QuotationMock[]>(SALES.quotations, quoteSeed).find(x => x.id === quoteId);
      if (!q) return ok(null);
      const ls = readKey<LeadRow[]>(SALES.leads, leadSeed);
      const lead = ls.find(l => (q.dealId != null && l.numId === q.dealId) || ((q.customerId ?? 0) > 0 && l.customerId === q.customerId));
      return ok(lead?.assigned ?? null);
    },
    listForCustomer: (customerId) =>
      ok(readKey<QuotationMock[]>(SALES.quotations, quoteSeed).filter(q => q.customerId === customerId && q.status === "won")),
    // mirror relink_customer_quotes ฝั่ง supabase (0093) — เธรดเดียวในเบราว์เซอร์ = atomic โดยธรรมชาติ
    relinkCustomerQuotes: (dealer, customerId, company, cascadeWon) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const relinked: QuotationMock[] = [];
      const next = list.map(q => {
        if ((q.dealerCode ?? DEFAULT_DEALER_CODE) === dealer && !(q.customerId > 0) && q.customer === company) {
          const carryWon = cascadeWon && q.status !== "lost" && q.status !== "expired";
          const nq = { ...q, customerId, status: carryWon ? ("won" as const) : q.status };
          relinked.push(nq);
          return nq;
        }
        return q;
      });
      writeKey(SALES.quotations, next);
      return ok(relinked);
    },
    // ออกเลข + insert (เธรดเดียวในเบราว์เซอร์ = atomic โดยธรรมชาติ ไม่มีเลขหาย)
    // รูปแบบ Q-{DealerCode}-{Year}-{Running} — ตัวนับนับแยกต่อสาขา (mirror ตัวนับต่อสาขาฝั่ง Supabase)
    // เดิมนับจากเลขสูงสุดที่เห็น "รวมทุกสาขา" ในเครื่อง — โหมด local ก็ต้องแยกสาขาเหมือนโหมดจริง (พบจากผลตรวจสอบ 31 ก.ค. 69)
    createNumbered: (dealer, prefix, row) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const mine = list.filter((q) => (q.dealerCode ?? DEFAULT_DEALER_CODE) === dealer);
      const nums = mine.map((q) => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
      const year = String(new Date().getFullYear());
      const id = `${prefix || "Q-"}${dealer}-${year}-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
      const created = { ...row, id, dealerCode: dealer } as QuotationMock;
      writeKey(SALES.quotations, [created, ...list]);
      return ok(created);
    },
  },
  customers: {
    list: (scope) => ok(scopeByDealer(readKey<CustomerRow[]>(SALES.customers, initialCustomers), scope)),
    // หน้าเดียว + ค้นหา (M9 Phase 5) — mirror ตรรกะ supabase
    listPage: (scope, opts) => {
      const s = (opts.search ?? "").trim().toLowerCase();
      let arr = scopeByDealer(readKey<CustomerRow[]>(SALES.customers, initialCustomers), scope).filter(c => {
        if (opts.dealerCodes?.length && !opts.dealerCodes.includes(c.dealerCode ?? DEFAULT_DEALER_CODE)) return false;
        if (s && !`${c.name ?? ""} ${c.company ?? ""} ${c.province ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(s)) return false;
        return true;
      });
      arr = [...arr].sort((a, b) => a.id - b.id);
      return ok({ rows: arr.slice(opts.offset, opts.offset + opts.limit), total: arr.length });
    },
    // โหมด local มีผู้ใช้คนเดียวต่อเครื่อง → max+1 พอ (โหมด supabase ใช้ RPC atomic)
    nextId: (dealerCode) => {
      const mine = scopeByDealer(readKey<CustomerRow[]>(SALES.customers, initialCustomers), { dealerCode, isHQ: false });
      return ok(mine.reduce((m, c) => Math.max(m, c.id), 0) + 1);
    },
    create: (row) => {
      const list = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      writeKey(SALES.customers, [row, ...list]);
      return ok(row);
    },
    update: (row) => {
      const list = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      writeKey(SALES.customers, list.map((c) => (c.id === row.id ? row : c)));
      return ok(row);
    },
    remove: (id) => {
      const list = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      writeKey(SALES.customers, list.filter((c) => c.id !== id));
      return done();
    },
    // โหมด local มีผู้ใช้คนเดียวต่อเครื่อง → เช็ก+สร้างตรงนี้พอ (ไม่มี race ข้าม session จริงแบบ supabase)
    upsertForCompany: (dealerCode, row) => {
      const list = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      const mine = scopeByDealer(list, { dealerCode, isHQ: false });
      const ek = exactKey(row.company);
      const existing = mine.find((c) => exactKey(c.company) === ek);
      if (existing) return ok(existing);
      writeKey(SALES.customers, [row, ...list]);
      return ok(row);
    },
    // โหมด local เครื่องเดียว → คำนวณจากอาร์เรย์ในเครื่องตรง ๆ พอ (ไม่มี race ข้าม session จริงแบบ supabase)
    reconcileWonTotal: (customerId) => {
      const custs = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      const quotes = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const wonTotal = quotes.filter(q => q.customerId === customerId && q.status === "won").reduce((s, q) => s + (q.totalValue ?? 0), 0);
      const next = custs.map(c => c.id === customerId ? { ...c, totalValue: wonTotal } : c);
      writeKey(SALES.customers, next);
      const updated = next.find(c => c.id === customerId);
      if (!updated) throw new Error(`customer ${customerId} not found`);
      return ok(updated);
    },
    // mirror close_won_quotation ฝั่ง supabase (0094) — เธรดเดียวในเบราว์เซอร์ = ไม่มี partial-write จริง
    // อยู่แล้ว แต่เขียนให้ตรรกะตรงกันเป๊ะเพื่อพฤติกรรม Local/Supabase ไม่เพี้ยนกัน (M9 parity)
    closeWon: (args) => {
      const { dealer, knownCustomerId, leadCompany, targetQuoteId, cascadeWon, customerPayload } = args;
      const custList = readKey<CustomerRow[]>(SALES.customers, initialCustomers);
      let cust = knownCustomerId != null ? custList.find(c => c.id === knownCustomerId) : undefined;
      if (!cust) {
        const mine = scopeByDealer(custList, { dealerCode: dealer, isHQ: false });
        const ek = exactKey(customerPayload.company);
        cust = mine.find(c => exactKey(c.company) === ek);
        if (!cust) {
          cust = customerPayload;
          writeKey(SALES.customers, [cust, ...custList]);
        }
      }
      const custId = cust.id;
      const qList = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const nextQ = qList.map(q => {
        if ((q.dealerCode ?? DEFAULT_DEALER_CODE) === dealer && !(q.customerId > 0) && q.customer === leadCompany) {
          const carryWon = cascadeWon && q.status !== "lost" && q.status !== "expired";
          return { ...q, customerId: custId, status: carryWon ? ("won" as const) : q.status };
        }
        if (targetQuoteId && q.id === targetQuoteId) {
          return { ...q, customerId: custId, status: "won" as const };
        }
        return q;
      });
      writeKey(SALES.quotations, nextQ);
      const wonTotal = nextQ.filter(q => q.customerId === custId && q.status === "won").reduce((s, q) => s + (q.totalValue ?? 0), 0);
      const finalCustList = readKey<CustomerRow[]>(SALES.customers, initialCustomers).map(c => c.id === custId ? { ...c, totalValue: wonTotal } : c);
      writeKey(SALES.customers, finalCustList);
      const updated = finalCustList.find(c => c.id === custId);
      if (!updated) throw new Error(`customer ${custId} not found`);
      // ใบที่เกี่ยวข้องทั้งหมด — mirror เงื่อนไขเดียวกับฝั่ง supabase (ตรงชื่อบริษัท หรือคือใบเป้าหมาย)
      const related = nextQ.filter(q => q.customerId === custId && (q.customer === leadCompany || q.id === targetQuoteId));
      return ok({ customer: updated, quotations: related });
    },
  },
  appointments: {
    list: (scope) => ok(scopeByDealer(readKey<AppointmentMock[]>(SALES.appointments, apptSeed), scope)),
    listForDealer: (dealerCode) => ok(readKey<AppointmentMock[]>(SALES.appointments, apptSeed).filter(a => (a.dealerCode ?? DEFAULT_DEALER_CODE) === dealerCode)),
    listForLead: (leadId) => ok(readKey<AppointmentMock[]>(SALES.appointments, apptSeed).filter(a => a.leadId === leadId)),
    nextId: (dealerCode) => {
      const mine = scopeByDealer(readKey<AppointmentMock[]>(SALES.appointments, apptSeed), { dealerCode, isHQ: false });
      return ok(mine.reduce((m, a) => Math.max(m, a.id), 0) + 1);
    },
    create: (row) => {
      const list = readKey<AppointmentMock[]>(SALES.appointments, apptSeed);
      writeKey(SALES.appointments, [row, ...list]);
      return ok(row);
    },
    update: (row) => {
      const list = readKey<AppointmentMock[]>(SALES.appointments, apptSeed);
      writeKey(SALES.appointments, list.map((a) => (a.id === row.id ? row : a)));
      return ok(row);
    },
    remove: (id) => {
      const list = readKey<AppointmentMock[]>(SALES.appointments, apptSeed);
      writeKey(SALES.appointments, list.filter((a) => a.id !== id));
      return done();
    },
  },
};
