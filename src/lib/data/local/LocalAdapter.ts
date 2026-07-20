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
} from "@/lib/mock";
import { loadAudit, appendAudit } from "@/lib/useAudit";
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

  // งานขาย — อ่านอย่างเดียวใน Step 0 (fallback = seed) · CRUD ต่อผ่าน SalesContext ใน Step 1
  leads: { list: (scope) => ok(scopeLeads(readKey<LeadRow[]>(SALES.leads, leadSeed), scope)) },
  quotations: { list: () => ok(readKey<QuotationMock[]>(SALES.quotations, quoteSeed)) },
  customers: { list: () => ok(readKey<CustomerRow[]>(SALES.customers, initialCustomers)) },
  appointments: { list: () => ok(readKey<AppointmentMock[]>(SALES.appointments, apptSeed)) },
};
