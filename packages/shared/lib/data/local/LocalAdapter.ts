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
function firePropfile() {
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
  realtime: { subscribeSales: () => () => {}, subscribeCatalog: () => () => {}, subscribeSettings: () => () => {} },
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
    save: (p) => { writeKey(profileKey(currentDealerCode()), p); firePropfile(); return done(); },
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
    list: () => ok(loadAudit()),
    append: (e) => { appendAudit(e); return done(); },
  },

  // งานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) · เขียนลง localStorage คีย์เดียวกับ SalesContext
  leads: {
    list: (scope) => ok(scopeByDealer(readKey<LeadRow[]>(SALES.leads, leadSeed), scope)),
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
