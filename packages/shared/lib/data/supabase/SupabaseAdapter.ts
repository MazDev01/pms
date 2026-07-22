"use client";

// SupabaseAdapter — เชื่อม repository ทุกตัวเข้ากับตาราง Supabase (เฟส B)
// map ตาราง ↔ type ตาม BACKEND-DESIGN.md · ขอบเขตข้อมูล (dealer_code) บังคับด้วย RLS ที่ DB
// แปลง snake_case (DB) ↔ camelCase (type) ด้วย mappers.ts
import { getSupabase } from "./client";
import { toCamel, toCamelList, toSnake, toSnakeList } from "./mappers";
import type { DataAdapter } from "../ports";
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, DealerLeadRulesMap, LeadRules,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
} from "../types";

const sb = () => getSupabase();
type Row = Record<string, unknown>;

// select ทั้งตาราง + กรองตาม scope (ตัวแทน = เฉพาะสาขาตัวเอง · HQ = ทั้งหมด) → แปลงเป็น camelCase
async function selectScoped<T>(table: string, scope?: Scope, col = "dealer_code"): Promise<T[]> {
  const base = sb().from(table).select("*");
  const q = scope && !scope.isHQ && scope.dealerCode ? base.eq(col, scope.dealerCode) : base;
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return toCamelList<T>((data ?? []) as Row[]);
}

async function must(p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

async function one<T>(table: string): Promise<T | null> {
  const { data, error } = await sb().from(table).select("*").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCamel<T>(data as Row) : null;
}

export const SupabaseAdapter: DataAdapter = {
  dealers: {
    list: () => selectScoped<DealerRow>("dealers"),
    save: (all) => must(sb().from("dealers").upsert(toSnakeList(all as unknown as Row[]))),
  },
  catalog: {
    list: () => selectScoped<SolutionProduct>("master_catalog"),
    save: (all) => must(sb().from("master_catalog").upsert(toSnakeList(all as unknown as Row[]))),
  },
  files: {
    list: () => selectScoped<DealerFile>("files"),
    add: async (f) => {
      const { data, error } = await sb().from("files").insert(toSnake(f as unknown as Row)).select().single();
      if (error) throw new Error(error.message);
      return toCamel<DealerFile>(data as Row);
    },
    remove: (id) => must(sb().from("files").delete().eq("id", id)),
  },
  persons: {
    list: () => selectScoped<ResponsiblePerson>("responsible_persons"),
    save: (all) => must(sb().from("responsible_persons").upsert(toSnakeList(all as unknown as Row[]))),
  },
  settings: {
    getPolicy: async () => (await one<HQPolicy>("hq_policy")) as HQPolicy,
    getTargets: async () => (await one<HQTargets>("hq_targets")) as HQTargets,
    getNotifRules: async () => (await one<HQNotifRules>("hq_notif_rules")) as HQNotifRules,
    getLeadRulesMap: async () => {
      const rows = await selectScoped<{ dealerCode: string } & LeadRules>("dealer_lead_rules", { isHQ: true });
      const map: DealerLeadRulesMap = {};
      for (const r of rows) map[r.dealerCode] = r;
      return map;
    },
    saveLeadRules: (code, rules) =>
      must(sb().from("dealer_lead_rules").upsert(toSnake({ dealerCode: code, ...rules } as unknown as Row))),
    getQuoteValidityDays: async () => {
      const p = await one<HQPolicy>("hq_policy");
      return p?.quoteValidityDays ?? 30;
    },
  },
  audit: {
    list: async () => {
      const { data, error } = await sb().from("audit_log").select("*").order("at", { ascending: false });
      if (error) throw new Error(error.message);
      return toCamelList<AuditEntry>((data ?? []) as Row[]);
    },
    append: (e) => must(sb().from("audit_log").insert(toSnake(e as unknown as Row))),
  },

  leads: { list: (scope) => selectScoped<LeadRow>("leads", scope) },
  quotations: { list: (scope) => selectScoped<QuotationMock>("quotations", scope) },
  customers: { list: (scope) => selectScoped<CustomerRow>("customers", scope) },
  appointments: { list: (scope) => selectScoped<AppointmentMock>("appointments", scope) },
};
