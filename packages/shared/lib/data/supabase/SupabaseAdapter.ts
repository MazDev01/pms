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

// insert 1 แถว → คืนแถวที่ DB บันทึกจริง (id/created_at ที่ DB สร้างให้) เป็น camelCase
async function insertRow<T>(table: string, row: T): Promise<T> {
  const { data, error } = await sb().from(table).insert(toSnake(row as unknown as Row)).select().single();
  if (error) throw new Error(error.message);
  return toCamel<T>(data as Row);
}
// update ทั้งแถวตาม id → คืนแถวหลังอัปเดต
async function updateRow<T>(table: string, id: string | number, row: T): Promise<T> {
  const { data, error } = await sb().from(table).update(toSnake(row as unknown as Row)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return toCamel<T>(data as Row);
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

  // งานขาย — RLS ที่ DB คุมขอบเขต (insert ต้องมี dealer_code = สาขา session · with-check)
  leads: {
    list: (scope) => selectScoped<LeadRow>("leads", scope),
    create: (row) => insertRow<LeadRow>("leads", row),
    update: (row) => updateRow<LeadRow>("leads", row.id, row),
    remove: (id) => must(sb().from("leads").delete().eq("id", id)),
    setStatus: (id, status) => must(sb().from("leads").update({ status }).eq("id", id)),
  },
  quotations: {
    list: (scope) => selectScoped<QuotationMock>("quotations", scope),
    create: (row) => insertRow<QuotationMock>("quotations", row),
    update: (row) => updateRow<QuotationMock>("quotations", row.id, row),
    remove: (id) => must(sb().from("quotations").delete().eq("id", id)),
    setStatus: (id, status) => must(sb().from("quotations").update({ status }).eq("id", id)),
  },
  customers: {
    list: (scope) => selectScoped<CustomerRow>("customers", scope),
    create: (row) => insertRow<CustomerRow>("customers", row),
    update: (row) => updateRow<CustomerRow>("customers", row.id, row),
    remove: (id) => must(sb().from("customers").delete().eq("id", id)),
  },
  appointments: {
    list: (scope) => selectScoped<AppointmentMock>("appointments", scope),
    create: (row) => insertRow<AppointmentMock>("appointments", row),
    update: (row) => updateRow<AppointmentMock>("appointments", row.id, row),
    remove: (id) => must(sb().from("appointments").delete().eq("id", id)),
  },
};
