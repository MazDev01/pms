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
import type { DataAdapter } from "../ports";
import type { LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope } from "../types";

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
  },
  catalog: {
    list: () => ok(loadMasterCatalog()),
    // บันทึกแล้วยิง event → หน้าอื่น (origin เดียวกัน) ที่ใช้ useMasterCatalog โหลดใหม่ทันที
    save: (all) => {
      writeKey(MASTER_CATALOG_KEY, all);
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
    nextQuoteNo: () => {
      const list = readKey<QuotationMock[]>(SALES.quotations, quoteSeed);
      const nums = list.map((q) => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
      return ok(`Q-2026-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`);
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
