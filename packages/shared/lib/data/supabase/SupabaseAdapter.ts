"use client";

// SupabaseAdapter — เชื่อม repository ทุกตัวเข้ากับตาราง Supabase (เฟส B)
// map ตาราง ↔ type ตาม BACKEND-DESIGN.md · ขอบเขตข้อมูล (dealer_code) บังคับด้วย RLS ที่ DB
// แปลง snake_case (DB) ↔ camelCase (type) ด้วย mappers.ts
import { getSupabase } from "./client";
import { toCamel, toCamelList, toSnake, toSnakeList } from "./mappers";
import { DEFAULT_HQ_POLICY, DEFAULT_HQ_TARGETS, DEFAULT_HQ_NOTIF_RULES } from "@pms/shared/lib/mock";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import type { DataAdapter } from "../ports";
import type { SalesTable, SalesChange } from "../ports";
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, DealerLeadRulesMap, LeadRules,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
} from "../types";

const sb = () => getSupabase();
type Row = Record<string, unknown>;

// at (timestamptz ISO) → "30 มิ.ย. 2569 · 09:22" (รูปแบบเดียวกับ stampNow ใน useAudit ที่ parseDate อ่านได้)
const TH_MO_AUDIT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function fmtAuditAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${TH_MO_AUDIT[d.getMonth()]} ${d.getFullYear() + 543} · ${hh}:${mm}`;
}

// PostgREST คืนสูงสุดต่อคำขอ (ค่าเริ่มต้น 1,000 แถว) — ถ้าไม่ไล่ทีละหน้า ข้อมูลจะถูก "ตัดเงียบ ๆ"
// ผู้ใช้เห็นแค่ 1,000 แถวแรกโดยไม่มีคำเตือน (C2)
const PAGE_ROWS = 1000;
type RowsResult = { data: unknown[] | null; error: { message: string } | null };

// ไล่ดึงทุกหน้าจนครบ · ต้องมี ORDER ที่เสถียรเสมอ ไม่งั้นแบ่งหน้าแล้วแถวซ้ำ/ตกหล่นได้
// (Postgres ไม่รับประกันลำดับถ้าไม่ระบุ order)
async function pageAll(run: (from: number, to: number) => PromiseLike<RowsResult>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await run(from, from + PAGE_ROWS - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
  }
  return out;
}

// select ทั้งตาราง + กรองตาม scope (ตัวแทน = เฉพาะสาขาตัวเอง · HQ = ทั้งหมด) → แปลงเป็น camelCase
async function selectScoped<T>(table: string, scope?: Scope, col = "dealer_code", orderCol = "id"): Promise<T[]> {
  const rows = await pageAll((from, to) => {
    const base = sb().from(table).select("*").order(orderCol, { ascending: true }).range(from, to);
    return scope && !scope.isHQ && scope.dealerCode ? base.eq(col, scope.dealerCode) : base;
  });
  return toCamelList<T>(rows);
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

// ── leads: LeadRow ↔ DB (มี field เฉพาะที่ต้องแปลงพิเศษ) ──
//   • createdAt (สตริงวันที่ไทย) → คอลัมน์ created_label · ห้ามชน created_at (timestamptz เวลาจริงของ DB)
//   • area: แอปเป็น number · DB เป็น text → แปลงไป-กลับ
function leadToRow(l: LeadRow): Row {
  const r = toSnake(l as unknown as Row);
  if ("created_at" in r) { r.created_label = r.created_at; delete r.created_at; }
  if (r.area != null) r.area = String(r.area);
  return r;
}
function rowToLead(row: Row): LeadRow {
  const l = toCamel<Record<string, unknown>>(row);
  if (typeof l.createdLabel === "string") l.createdAt = l.createdLabel; // แสดงผลด้วยสตริงไทยจากแอป
  delete l.createdLabel;
  if (typeof l.area === "string" && l.area !== "") l.area = Number(l.area);
  else if (l.area === "" || l.area === null) delete l.area;
  return l as unknown as LeadRow;
}

// ── quotations: QuotationMock ↔ DB — area number↔text (คอลัมน์ area เป็น text) ──
function quoteToRow(q: QuotationMock): Row {
  const r = toSnake(q as unknown as Row);
  if (r.area != null) r.area = String(r.area);
  return r;
}
function rowToQuote(row: Row): QuotationMock {
  const q = toCamel<Record<string, unknown>>(row);
  if (typeof q.area === "string" && q.area !== "") q.area = Number(q.area);
  else if (q.area === "" || q.area === null) q.area = 0;
  return q as unknown as QuotationMock;
}

// ── appointments: AppointmentMock ↔ DB — area number↔text (คอลัมน์ area เป็น text) ──
function apptToRow(a: AppointmentMock): Row {
  const r = toSnake(a as unknown as Row);
  if (r.area != null) r.area = String(r.area);
  return r;
}
function rowToAppt(row: Row): AppointmentMock {
  const a = toCamel<Record<string, unknown>>(row);
  if (typeof a.area === "string" && a.area !== "") a.area = Number(a.area);
  else if (a.area === "" || a.area === null) a.area = 0;
  return a as unknown as AppointmentMock;
}

// เลข id ถัดไปต่อสาขาแบบ atomic — DB เป็นคนออกให้ (กันชนเมื่อสร้างพร้อมกันในสาขาเดียวกัน)
async function nextEntityId(dealerCode: string, entity: "customers" | "appointments"): Promise<number> {
  const { data, error } = await sb().rpc("next_entity_id", { p_dealer: dealerCode, p_entity: entity });
  if (error) throw new Error(error.message);
  return Number(data);
}

const FILES_BUCKET = "dealer-files";

// ชื่อช่อง Realtime ต้องไม่ซ้ำกันต่อการ subscribe หนึ่งครั้ง
// ถ้าใช้ชื่อตายตัว: หลายคอมโพเนนต์ที่ subscribe พร้อมกัน (เช่น useHQPolicy + useQuoteValidityDays
// ในหน้าเดียว) จะได้ channel instance เดิมที่ subscribe ไปแล้ว → เติม .on() ไม่ได้
// ("cannot add postgres_changes callbacks after subscribe()") และตัวหลังจะไม่ได้รับ event เลย
let channelSeq = 0;
const topic = (base: string) => `${base}-${++channelSeq}`;

export const SupabaseAdapter: DataAdapter = {
  // ไฟล์จริงใน Storage — พาธขึ้นต้นด้วยรหัสสาขาเสมอ (Storage RLS คุมด้วย foldername[1])
  storage: {
    upload: async (dealerCode, file) => {
      // Storage key ต้องเป็น ASCII ล้วน (ไทย/ช่องว่าง → "Invalid key") — ชื่อจริงเก็บใน metadata (files.name) อยู่แล้ว
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_") || "file";
      const path = `${dealerCode}/${Date.now()}-${safe}`;
      const { error } = await sb().storage.from(FILES_BUCKET).upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      return path;
    },
    signedUrl: async (path) => {
      const { data, error } = await sb().storage.from(FILES_BUCKET).createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data?.signedUrl ?? null;
    },
    remove: async (path) => {
      const { error } = await sb().storage.from(FILES_BUCKET).remove([path]);
      if (error) throw new Error(error.message);
    },
  },
  // Realtime — ช่องเดียวฟังครบ 4 ตารางงานขาย · RLS กรอง event ให้ตามสาขาที่ล็อกอินอยู่แล้ว
  realtime: {
    // ส่ง "แถวที่เปลี่ยน" มาให้เลย (แปลงเป็น type ของแอปแล้ว) → หน้าจอ patch เฉพาะแถว ไม่ต้องโหลดทั้งตาราง
    // DELETE ได้ record เดิมมาด้วยเพราะตั้ง replica identity full ไว้ใน 0011
    subscribeSales: (onChange) => {
      const toRow: Record<SalesTable, (r: Row) => unknown> = {
        leads: rowToLead,
        quotations: rowToQuote,
        appointments: rowToAppt,
        customers: (r) => toCamel<CustomerRow>(r),
      };
      const ch = sb().channel(topic("sales-changes"));
      for (const t of Object.keys(toRow) as SalesTable[]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => {
          if (p.eventType === "DELETE") {
            const id = (p.old as Row | undefined)?.id;
            if (id != null) onChange({ table: t, type: "DELETE", id: id as string | number });
            return;
          }
          onChange({
            table: t,
            type: p.eventType as "INSERT" | "UPDATE",
            row: toRow[t](p.new as Row),
          } as SalesChange);
        });
      }
      ch.subscribe();
      return () => { void sb().removeChannel(ch); };
    },
    subscribeCatalog: (onChange) => {
      const ch = sb().channel(topic("catalog-changes"))
        .on("postgres_changes", { event: "*", schema: "public", table: "master_catalog" }, () => onChange());
      ch.subscribe();
      return () => { void sb().removeChannel(ch); };
    },
    subscribeSettings: (onChange) => {
      const ch = sb().channel(topic("settings-changes"));
      for (const t of ["hq_policy", "hq_targets", "hq_notif_rules"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange());
      }
      ch.subscribe();
      return () => { void sb().removeChannel(ch); };
    },
  },
  dealers: {
    // ตาราง dealers ใช้ code เป็น PK — ไม่มีคอลัมน์ id (แต่ DealerRow ของแอปมี id และ mock ตั้ง id = code เสมอ)
    // ถ้าไม่เติมให้ ทุกแถวจะได้ id = undefined → React key ซ้ำ + หน้าจอที่อ้าง d.id พัง
    list: async () => (await selectScoped<DealerRow>("dealers", undefined, "dealer_code", "code")).map(d => ({ ...d, id: d.id ?? d.code })),
    // ตัดฟิลด์ที่ไม่มีคอลัมน์ใน DB ออกก่อน upsert:
    //   • id          — ตารางใช้ code เป็น PK
    //   • credentials — รหัสผ่านอยู่ใน Supabase Auth (hash) ห้ามเก็บซ้ำในตารางนี้
    save: (all) => must(sb().from("dealers").upsert(
      all.map(d => { const r = toSnake(d as unknown as Row); delete r.id; delete r.credentials; return r; }),
      { onConflict: "code" },
    )),
  },
  catalog: {
    list: () => selectScoped<SolutionProduct>("master_catalog"),
    save: (all) => must(sb().from("master_catalog").upsert(toSnakeList(all as unknown as Row[]))),
  },
  files: {
    list: (scope) => selectScoped<DealerFile>("files", scope),
    add: async (f) => {
      const { data, error } = await sb().from("files").insert(toSnake(f as unknown as Row)).select().single();
      if (error) throw new Error(error.message);
      return toCamel<DealerFile>(data as Row);
    },
    update: (f) => must(sb().from("files").update(toSnake(f as unknown as Row)).eq("id", f.id)),
    remove: (id) => must(sb().from("files").delete().eq("id", id)),
  },
  persons: {
    list: async (scope) => {
      const rows = await selectScoped<ResponsiblePerson>("responsible_persons", scope);
      return rows.map((p, i) => ({ ...p, id: i + 1 })); // reindex เป็น 1..n (แอปใช้ id เป็น index ท้องถิ่น)
    },
    // แทนที่ทั้งชุดของสาขา: ลบของสาขา (RLS = เฉพาะสาขาตัวเอง) แล้วใส่ใหม่ (ไม่ส่ง id — DB gen identity)
    save: async (all, dealerCode) => {
      await must(sb().from("responsible_persons").delete().eq("dealer_code", dealerCode));
      const rows = all.map(p => { const r = toSnake({ ...p, dealerCode } as unknown as Row); delete r.id; return r; });
      if (rows.length) await must(sb().from("responsible_persons").insert(rows));
    },
  },
  settings: {
    // singleton (id=1) — fallback เป็น default ถ้าแถวยังไม่ถูก seed (กัน null → หน้า HQ crash)
    getPolicy: async () => (await one<HQPolicy>("hq_policy")) ?? DEFAULT_HQ_POLICY,
    getTargets: async () => (await one<HQTargets>("hq_targets")) ?? DEFAULT_HQ_TARGETS,
    getNotifRules: async () => (await one<HQNotifRules>("hq_notif_rules")) ?? DEFAULT_HQ_NOTIF_RULES,
    savePolicy: (p) => must(sb().from("hq_policy").upsert({ id: 1, ...toSnake(p as unknown as Row) })),
    saveTargets: (t) => must(sb().from("hq_targets").upsert({ id: 1, ...toSnake(t as unknown as Row) })),
    saveNotifRules: (r) => must(sb().from("hq_notif_rules").upsert({ id: 1, ...toSnake(r as unknown as Row) })),
    getLeadRulesMap: async () => {
      // ตารางนี้ใช้ dealer_code เป็น PK — ไม่มีคอลัมน์ id จึงต้องระบุคอลัมน์เรียงเอง
      const rows = await selectScoped<{ dealerCode: string } & LeadRules>("dealer_lead_rules", { isHQ: true }, "dealer_code", "dealer_code");
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
    // อ่านเรียงล่าสุดก่อน (id desc) + แปลง at (timestamptz) → สตริงไทยที่ /hq/audit (parseDate) เข้าใจ
    list: async () => {
      const rows = await pageAll((from, to) =>
        sb().from("audit_log").select("*").order("id", { ascending: false }).range(from, to));
      return rows.map(r => ({ ...toCamel<AuditEntry>(r), at: fmtAuditAt(String(r.at)) }));
    },
    // ประทับ at ด้วย "วันนี้ของระบบ" (APP_NOW) + เวลาจริง → รายการอยู่ในช่วงตัวกรอง /hq/audit (แช่แข็งเวลา)
    append: (e) => {
      const t = new Date();
      const at = new Date(APP_NOW.getFullYear(), APP_NOW.getMonth(), APP_NOW.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
      return must(sb().from("audit_log").insert({ ...toSnake(e as unknown as Row), at: at.toISOString() }));
    },
  },

  // งานขาย — RLS ที่ DB คุมขอบเขต (insert ต้องมี dealer_code = สาขา session · with-check)
  // leads ใช้ mapper เฉพาะ (leadToRow/rowToLead) เพราะ id เป็น text + createdAt/area ต้องแปลงพิเศษ
  leads: {
    list: async (scope) => {
      const rows = await pageAll((from, to) => {
        const base = sb().from("leads").select("*").order("id", { ascending: true }).range(from, to);
        return scope && !scope.isHQ && scope.dealerCode ? base.eq("dealer_code", scope.dealerCode) : base;
      });
      return rows.map(rowToLead);
    },
    create: async (row) => {
      const { data, error } = await sb().from("leads").insert(leadToRow(row)).select().single();
      if (error) throw new Error(error.message);
      return rowToLead(data as Row);
    },
    update: async (row) => {
      const { data, error } = await sb().from("leads").update(leadToRow(row)).eq("id", row.id).select().single();
      if (error) throw new Error(error.message);
      return rowToLead(data as Row);
    },
    remove: (id) => must(sb().from("leads").delete().eq("id", id)),
    setStatus: (id, status) => must(sb().from("leads").update({ status }).eq("id", id)),
  },
  quotations: {
    list: async (scope) => {
      const rows = await pageAll((from, to) => {
        const base = sb().from("quotations").select("*").order("id", { ascending: true }).range(from, to);
        return scope && !scope.isHQ && scope.dealerCode ? base.eq("dealer_code", scope.dealerCode) : base;
      });
      return rows.map(rowToQuote);
    },
    create: async (row) => {
      const { data, error } = await sb().from("quotations").insert(quoteToRow(row)).select().single();
      if (error) throw new Error(error.message);
      return rowToQuote(data as Row);
    },
    update: async (row) => {
      const { data, error } = await sb().from("quotations").update(quoteToRow(row)).eq("id", row.id).select().single();
      if (error) throw new Error(error.message);
      return rowToQuote(data as Row);
    },
    remove: (id) => must(sb().from("quotations").delete().eq("id", id)),
    setStatus: (id, status) => must(sb().from("quotations").update({ status }).eq("id", id)),
    // ปิดใบที่เลยวันหมดอายุ — RLS ทำให้แต่ละสาขาปิดได้เฉพาะใบของตัวเอง (0019)
    expireOverdue: async (asOf) => {
      const { data, error } = await sb().rpc("expire_quotations", { p_as_of: asOf });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    // เลขที่ใบต่อสาขาแบบ atomic (กันเลขชนเมื่อออกพร้อมกัน/ข้ามสาขา) — RPC ที่ DB (0003)
    nextQuoteNo: async (dealer) => {
      const { data, error } = await sb().rpc("next_quote_no", { p_dealer: dealer });
      if (error) throw new Error(error.message);
      return String(data);
    },
  },
  customers: {
    list: (scope) => selectScoped<CustomerRow>("customers", scope),
    nextId: (dealerCode) => nextEntityId(dealerCode, "customers"),
    create: (row) => insertRow<CustomerRow>("customers", row),
    update: (row) => updateRow<CustomerRow>("customers", row.id, row),
    remove: (id) => must(sb().from("customers").delete().eq("id", id)),
  },
  appointments: {
    nextId: (dealerCode) => nextEntityId(dealerCode, "appointments"),
    list: async (scope) => {
      const rows = await pageAll((from, to) => {
        const base = sb().from("appointments").select("*").order("id", { ascending: true }).range(from, to);
        return scope && !scope.isHQ && scope.dealerCode ? base.eq("dealer_code", scope.dealerCode) : base;
      });
      return rows.map(rowToAppt);
    },
    create: async (row) => {
      const { data, error } = await sb().from("appointments").insert(apptToRow(row)).select().single();
      if (error) throw new Error(error.message);
      return rowToAppt(data as Row);
    },
    update: async (row) => {
      const { data, error } = await sb().from("appointments").update(apptToRow(row)).eq("id", row.id).select().single();
      if (error) throw new Error(error.message);
      return rowToAppt(data as Row);
    },
    remove: (id) => must(sb().from("appointments").delete().eq("id", id)),
  },
};
