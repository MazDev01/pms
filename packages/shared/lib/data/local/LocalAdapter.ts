"use client";

// LocalAdapter — ห่อ loader / localStorage เดิม (mock.ts, useAudit.ts) โดยไม่แก้ของเดิม
// เป็น adapter เริ่มต้น (NEXT_PUBLIC_DATA_SOURCE=local) · พฤติกรรมเท่าเดิม แค่รวมเข้าท่อเดียว
import {
  loadHQDealers, HQ_DEALERS_KEY,
  loadMasterCatalog, MASTER_CATALOG_KEY,
  loadDealerFiles, addDealerFile, removeDealerFile,
  loadResponsiblePersons, RP_STORAGE_KEY,
  loadHQPolicy, loadHQTargets, loadHQNotifRules,
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

function scopeLeads(list: LeadRow[], scope?: Scope): LeadRow[] {
  if (!scope || scope.isHQ || !scope.dealerCode) return list;
  return list.filter(l => (l.dealerCode ?? scope.dealerCode) === scope.dealerCode);
}

export const LocalAdapter: DataAdapter = {
  dealers: {
    list: () => ok(loadHQDealers()),
    save: (all) => { writeKey(HQ_DEALERS_KEY, all); return done(); },
  },
  catalog: {
    list: () => ok(loadMasterCatalog()),
    save: (all) => { writeKey(MASTER_CATALOG_KEY, all); return done(); },
  },
  files: {
    list: () => ok(loadDealerFiles()),
    add: (f) => ok(addDealerFile(f)),
    remove: (id) => { removeDealerFile(id); return done(); },
  },
  persons: {
    list: () => ok(loadResponsiblePersons()),
    save: (all) => { writeKey(RP_STORAGE_KEY, all); return done(); },
  },
  settings: {
    getPolicy: () => ok(loadHQPolicy()),
    getTargets: () => ok(loadHQTargets()),
    getNotifRules: () => ok(loadHQNotifRules()),
    getLeadRulesMap: () => ok(loadDealerLeadRulesMap()),
    saveLeadRules: (code, rules) => { saveDealerLeadRules(code, rules); return done(); },
    getQuoteValidityDays: () => ok(loadQuoteValidityDays()),
  },
  audit: {
    list: () => ok(loadAudit()),
    append: (e) => { appendAudit(e); return done(); },
  },

  // งานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) · เขียนลง localStorage คีย์เดียวกับ SalesContext
  leads: {
    list: (scope) => ok(scopeLeads(readKey<LeadRow[]>(SALES.leads, leadSeed), scope)),
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
    list: () => ok(readKey<QuotationMock[]>(SALES.quotations, quoteSeed)),
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
  },
  customers: {
    list: () => ok(readKey<CustomerRow[]>(SALES.customers, initialCustomers)),
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
    list: () => ok(readKey<AppointmentMock[]>(SALES.appointments, apptSeed)),
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
