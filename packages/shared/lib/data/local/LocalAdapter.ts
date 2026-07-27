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
import { loadAudit, appendAudit } from "@pms/shared/lib/useAudit";
import { parseThaiDate as parseThaiDateLocal } from "@pms/shared/lib/leadMetrics";
import { profileKey, PROFILE_UPDATED_EVENT, sessions, type UserProfile } from "@pms/shared/lib/mock";

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
  return list.filter(r => (r.dealerCode ?? "CNX") === scope.dealerCode);
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
      const others = loadResponsiblePersons().filter(p => (p.dealerCode ?? "CNX") !== dealerCode);
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
      const defDays = opts?.defaultDays ?? 7;
      for (const q of qs) {
        const r = get(q.dealerCode ?? "CNX");
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
        const code = l.dealerCode ?? "CNX";
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
        if (f.dealerCodes?.length && !f.dealerCodes.includes(l.dealerCode ?? "CNX")) return false;
        if (f.province && l.province !== f.province) return false;
        if (f.product && l.product !== f.product) return false;
        if (f.source && (l.source || "ไม่ระบุ") !== f.source) return false;
        if (f.status && l.status !== f.status) return false;
        if (search && !`${l.company ?? ""} ${l.contact ?? ""} ${l.province ?? ""} ${l.product ?? ""} ${l.assigned ?? ""} ${l.id ?? ""} ${l.dealerCode ?? ""}`.toLowerCase().includes(search)) return false;
        return true;
      });
      const cnt = <K extends string>(key: (l: LeadRow) => K) => { const m = new Map<K, number>(); rows.forEach(l => m.set(key(l), (m.get(key(l)) ?? 0) + 1)); return m; };
      const statusM = cnt(l => l.status);
      const sourceM = cnt(l => (l.source || "ไม่ระบุ"));
      const productM = cnt(l => (l.product || "ไม่ระบุ"));
      const lostM = new Map<string, number>();
      rows.filter(l => l.status === "CANCELLED" && l.lostReason).forEach(l => lostM.set(l.lostReason!, (lostM.get(l.lostReason!) ?? 0) + 1));
      const monthM = new Map<string, { y: number; m: number; created: number; won: number; lost: number }>();
      rows.forEach(l => { const d = parseThaiDateLocal(l.createdAt ?? ""); if (!d) return; const y = d.getFullYear(), m = d.getMonth(), k = `${y}-${m}`; let r = monthM.get(k); if (!r) { r = { y, m, created: 0, won: 0, lost: 0 }; monthM.set(k, r); } r.created++; if (l.status === "PAID") r.won++; if (l.status === "CANCELLED") r.lost++; });
      return ok({
        byStatus: [...statusM.entries()].map(([status, count]) => ({ status, count })),
        bySource: [...sourceM.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
        byProduct: [...productM.entries()].map(([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count),
        byLostReason: [...lostM.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        byMonth: [...monthM.values()],
      });
    },
    customerRollup: () => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const m = new Map<string, { quoteNo: string; productLine: string; valueNum: number; date: string }[]>();
      for (const q of qs) {
        if (q.status !== "won") continue;
        const key = `${q.dealerCode ?? "CNX"}|${q.customer ?? ""}`;
        const b = { quoteNo: q.id, productLine: (q.buildingType || q.project) ?? "", valueNum: q.totalValue ?? 0, date: q.date ?? "" };
        const arr = m.get(key); if (arr) arr.push(b); else m.set(key, [b]);
      }
      for (const arr of m.values()) arr.sort((a, b) => a.date.localeCompare(b.date)); // order by date (ตรง jsonb_agg order by)
      return ok(m);
    },
    networkQuoteRange: (start, end, dealer) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const m = new Map<string, { quotes: number; won: number; lost: number; wonVal: number; quoteVal: number }>();
      for (const q of qs) {
        const md = /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "");
        if (!md) continue;
        const d = md[1];
        if (d < start || d > end) continue; // ISO string เทียบตามลำดับ = เทียบวันได้ตรง
        const code = q.dealerCode ?? "CNX";
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
        const code = q.dealerCode ?? "CNX";
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
    hqQuotationsSummary: (f) => {
      const qs = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const asOfMs = Date.parse(f.asOf ?? "2026-06-30");
      const search = (f.search ?? "").trim().toLowerCase();
      const plOf = (q: QuotationMock): string | null => { const bt = (q.buildingType ?? "").trim(); return bt ? bt : (q.project ?? null); };
      const dateOf = (q: QuotationMock) => /^(\d{4}-\d{2}-\d{2})/.exec(q.date || "")?.[1];
      const dM = new Map<string, { count: number; value: number; sent: number; won: number; lost: number; wonVal: number }>();
      const mM = new Map<string, { y: number; m: number; quotes: number; won: number; lost: number; wonVal: number }>();
      const pM = new Map<string | null, { value: number; projects: number }>();
      const agM = new Map<string, { count: number; value: number }>();
      for (const q of qs) {
        const d = dateOf(q); if (!d) continue;
        if (f.status && q.status !== f.status) continue;
        if (f.dealerCodes?.length && !f.dealerCodes.includes(q.dealerCode ?? "CNX")) continue;
        const pl = plOf(q);
        if (f.productLines?.length && (pl == null || !f.productLines.includes(pl))) continue;
        if (f.dateStart && d < f.dateStart) continue;
        if (f.dateEnd && d > f.dateEnd) continue;
        if (search && !`${q.id} ${q.customer ?? ""}`.toLowerCase().includes(search) && !f.searchDealers?.includes(q.dealerCode ?? "CNX")) continue;
        const code = q.dealerCode ?? "CNX", v = q.totalValue ?? 0;
        const y = Number(d.slice(0, 4)), mo = Number(d.slice(5, 7)) - 1;
        let dr = dM.get(code); if (!dr) { dr = { count: 0, value: 0, sent: 0, won: 0, lost: 0, wonVal: 0 }; dM.set(code, dr); }
        dr.count++; dr.value += v; if (q.status !== "draft") dr.sent++;
        if (q.status === "won") { dr.won++; dr.wonVal += v; } if (q.status === "lost") dr.lost++;
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
  },

  // งานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) · เขียนลง localStorage คีย์เดียวกับ SalesContext
  leads: {
    list: (scope) => ok(scopeByDealer(readKey<LeadRow[]>(SALES.leads, leadSeed), scope)),
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
        if (opts.dealerCodes?.length && !opts.dealerCodes.includes(q.dealerCode ?? "CNX")) return false;
        if (opts.productLines?.length) { const pl = plOf(q); if (pl === undefined || !opts.productLines.includes(pl)) return false; }
        const d = dateOf(q);
        if (opts.dateStart && (!d || d < opts.dateStart)) return false;
        if (opts.dateEnd && (!d || d > opts.dateEnd)) return false;
        if (s && !`${q.id} ${q.customer ?? ""}`.toLowerCase().includes(s) && !opts.searchDealers?.includes(q.dealerCode ?? "CNX")) return false;
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
    update: (row) => {
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
      writeKey(SALES.quotations, list.map((q) => (q.id === id ? { ...q, status } : q)));
      return done();
    },
    // ปิดใบที่เลยวันหมดอายุ (โหมด local ทำกับชุดของสาขานั้น)
    expireOverdue: (asOf, scope) => {
      const all = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      let n = 0;
      const next = all.map(q => {
        const mine = !scope || scope.isHQ || !scope.dealerCode || (q.dealerCode ?? "CNX") === scope.dealerCode;
        const overdue = q.status === "sent_to_client" && !!q.expiry && /^\d{4}-\d{2}-\d{2}$/.test(q.expiry) && q.expiry < asOf;
        if (mine && overdue) { n++; return { ...q, status: "expired" as const }; }
        return q;
      });
      if (n) writeKey(SALES.quotations, next);
      return ok(n);
    },
    // เลขที่ใบถัดไป = max ของเลขท้าย +1 (เทียบเท่า nextQId เดิมในหน้าจอ) · dealer ไม่ใช้ในโหมด local
    nextQuoteNo: (_dealer, prefix) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const nums = list.map((q) => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
      return ok(`${prefix || "Q-2026-"}${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`);
    },
    // ออกเลข + insert (เธรดเดียวในเบราว์เซอร์ = atomic โดยธรรมชาติ ไม่มีเลขหาย)
    createNumbered: (dealer, prefix, row) => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const nums = list.map((q) => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
      const id = `${prefix || "Q-2026-"}${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
      const created = { ...row, id, dealerCode: dealer } as QuotationMock;
      writeKey(SALES.quotations, [created, ...list]);
      return ok(created);
    },
  },
  customers: {
    list: (scope) => ok(scopeByDealer(readKey<CustomerRow[]>(SALES.customers, initialCustomers), scope)),
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
  },
  appointments: {
    list: (scope) => ok(scopeByDealer(readKey<AppointmentMock[]>(SALES.appointments, apptSeed), scope)),
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
