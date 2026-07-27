"use client";

// SupabaseAdapter — เชื่อม repository ทุกตัวเข้ากับตาราง Supabase (เฟส B)
// map ตาราง ↔ type ตาม BACKEND-DESIGN.md · ขอบเขตข้อมูล (dealer_code) บังคับด้วย RLS ที่ DB
// แปลง snake_case (DB) ↔ camelCase (type) ด้วย mappers.ts
import { getSupabase } from "./client";
import { toCamel, toCamelList, toSnake, toSnakeList } from "./mappers";
import { DEFAULT_HQ_POLICY, DEFAULT_HQ_TARGETS, DEFAULT_HQ_NOTIF_RULES, LOST_REASONS,
  DEFAULT_ISSUER, DEFAULT_NOTIF_PREFS } from "@pms/shared/lib/mock";
import { DEFAULT_DOC } from "@pms/shared/lib/quotationPrint";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import type { DataAdapter, DealerRollup, QuoteRangeRow, DashboardQuoteSummary, HQQuotationsSummary, WonBuildingRaw, LeadSummary } from "../ports";
import type { SalesTable, SalesChange } from "../ports";
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, DealerLeadRulesMap, LeadRules,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
  DealerSettings, UserProfile, HQCompany, CustomerNote, SystemUser,
} from "../types";

const EMPTY_HQ_COMPANY: HQCompany = { name: "", address: "", taxId: "", phone: "", email: "", website: "" };

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
// ── กันเบราว์เซอร์ค้าง (M8) ──
// pageAll วนดึงทีละ PAGE_ROWS จน "หมดตาราง" — ที่สเกลใหญ่ (หลายแสนแถว) โหลดทั้งก้อนเข้าหน่วยความจำ
// = แท็บค้าง/ตาย · ใส่เพดานแข็ง: เกินแล้ว "หยุด + เตือนดังในคอนโซล" (ไม่เงียบ) แทนที่จะค้างจนตาย
// การแก้จริงที่สเกลนั้นคือ server-side paging/aggregate (M8 เต็ม/M9) ไม่ใช่ดันเพดานนี้ให้สูงขึ้น
const PAGE_HARD_CAP = 50000;
async function pageAll(run: (from: number, to: number) => PromiseLike<RowsResult>, label = "table"): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await run(from, from + PAGE_ROWS - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
    if (out.length >= PAGE_HARD_CAP) {
      console.warn(`[pageAll] "${label}" เกิน ${PAGE_HARD_CAP.toLocaleString()} แถว — หยุดโหลดเพื่อกันเบราว์เซอร์ค้าง · ข้อมูลที่ได้ไม่ครบ ต้องทำ server-side paging/aggregate (M8/M9)`);
      break;
    }
  }
  return out;
}

// select ทั้งตาราง + กรองตาม scope (ตัวแทน = เฉพาะสาขาตัวเอง · HQ = ทั้งหมด) → แปลงเป็น camelCase
async function selectScoped<T>(table: string, scope?: Scope, col = "dealer_code", orderCol = "id"): Promise<T[]> {
  const rows = await pageAll((from, to) => {
    const base = sb().from(table).select("*").order(orderCol, { ascending: true }).range(from, to);
    return scope && !scope.isHQ && scope.dealerCode ? base.eq(col, scope.dealerCode) : base;
  }, table);
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
  delete r.product_line; // คอลัมน์ generated (0041) — เขียนไม่ได้ · เผลอส่งไป Postgres จะปฏิเสธทั้งคำสั่ง
  if (r.area != null) r.area = String(r.area);
  // customer_id: แอปใช้ 0 = "ยังไม่มีลูกค้า" (ออกใบให้ลีด) → เก็บเป็น NULL ที่ DB (M6)
  // เพื่อให้ใส่ FK (dealer_code, customer_id) → customers ได้ · 0 ไม่ใช่ id ลูกค้าจริง (เริ่มที่ 1)
  if (!r.customer_id) r.customer_id = null;
  return r;
}
function rowToQuote(row: Row): QuotationMock {
  const q = toCamel<Record<string, unknown>>(row);
  if (typeof q.area === "string" && q.area !== "") q.area = Number(q.area);
  else if (q.area === "" || q.area === null) q.area = 0;
  // NULL จาก DB → 0 ที่แอปคาดหวัง (ตรรกะฝั่งแอปยังใช้ 0 เหมือนเดิม ไม่ต้องแก้ทั้งแอป)
  if (q.customerId == null) q.customerId = 0;
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
async function nextEntityId(dealerCode: string, entity: "customers" | "appointments" | "leads"): Promise<number> {
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
      // ต้องครบทุกตารางที่ HQ เป็นเจ้าของและตัวแทนต้องใช้ตาม
      // (0021 เปิด Realtime ให้ hq_sales_journey ไว้แล้ว แต่ฝั่ง client ลืมฟัง
      //  → เหตุผลปิดการขายที่ HQ แก้ ตัวแทนไม่เห็นจนกว่าจะรีโหลดหน้า)
      for (const t of ["hq_policy", "hq_targets", "hq_notif_rules", "hq_sales_journey"]) {
        ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange());
      }
      ch.subscribe();
      return () => { void sb().removeChannel(ch); };
    },
    // โน้ตลูกค้า — RLS กรอง event ให้เห็นเฉพาะของสาขาตัวเอง (0028 เปิด Realtime + replica identity full)
    subscribeNotes: (onChange) => {
      const ch = sb().channel(topic("notes-changes"))
        .on("postgres_changes", { event: "*", schema: "public", table: "customer_notes" }, () => onChange());
      ch.subscribe();
      return () => { void sb().removeChannel(ch); };
    },
    // ตั้งค่าของสาขา — 0024 เปิด Realtime + replica identity full · RLS กรองเฉพาะของสาขาตัวเอง (M4)
    subscribeDealerSettings: (onChange) => {
      const ch = sb().channel(topic("dealer-settings-changes"))
        .on("postgres_changes", { event: "*", schema: "public", table: "dealer_settings" }, () => onChange());
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
    // save = "เพิ่ม/แก้เท่าที่ส่งมา" เท่านั้น · การลบต้องเรียก remove() ตรง ๆ
    //
    // ⚠️ เคยทำเป็น "แทนที่ทั้งชุด" คือลบทุกแถวที่ไม่ได้อยู่ในอาร์เรย์ที่ส่งมา — อันตรายมาก
    //    ถ้าหน้าจอยังโหลดทะเบียนไม่เสร็จแล้วผู้ใช้กดเพิ่ม อาร์เรย์จะมีแค่แถวใหม่แถวเดียว
    //    → สั่งลบสาขาจริงที่เหลือทั้งหมด (เคยเกิดจริง รอดเพราะ FK ของตารางไฟล์กันไว้เฉย ๆ)
    //    การลบต้องมาจากเจตนาของผู้ใช้เท่านั้น ห้ามอนุมานจาก "แถวหายไปจากอาร์เรย์"
    save: async (all) => {
      // ตัด created_at ทิ้งด้วย — DB เป็นเจ้าของ (default now()) และห้ามให้แอปเขียนทับ
      //
      // ⚠️ ถ้าไม่ตัด: upsert เป็น bulk · PostgREST รวมชุดคอลัมน์จาก "ทุกแถว" ให้เท่ากัน
      //    สาขาเดิมที่โหลดมาจาก DB มี created_at · สาขาใหม่ที่เพิ่งกรอกในฟอร์มไม่มี
      //    → แถวใหม่ถูกเติมเป็น null → ชน not-null → เพิ่มตัวแทนใหม่ไม่สำเร็จเลยสักครั้ง
      const rows = all.map(d => {
        const r = toSnake(d as unknown as Row);
        delete r.id; delete r.credentials; delete r.created_at;
        return r;
      });
      await must(sb().from("dealers").upsert(rows, { onConflict: "code" }));
    },
    remove: (code) => must(sb().from("dealers").delete().eq("code", code)),
  },
  catalog: {
    list: () => selectScoped<SolutionProduct>("master_catalog"),
    save: async (all) => {
      // เหตุผลเดียวกับ dealers.save — created_at เป็นของ DB (ดูคำอธิบายด้านบน)
      const rows = toSnakeList(all as unknown as Row[]).map(r => { const c = { ...r }; delete c.created_at; return c; });
      await must(sb().from("master_catalog").upsert(rows));
    },
    remove: (id) => must(sb().from("master_catalog").delete().eq("id", id)),
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
    // lost เป็น text[] ของ Postgres — ไม่ต้องแปลงคีย์ (คอลัมน์เดียว ชื่อตรงอยู่แล้ว)
    // แถวยังไม่ถูก seed / รายการว่าง → ใช้ค่าเริ่มต้นกลาง ไม่ปล่อยให้ตัวแทนได้ dropdown เปล่า
    getLostReasons: async () => {
      const row = await one<{ lost?: string[] }>("hq_sales_journey");
      return row?.lost?.length ? row.lost : [...LOST_REASONS];
    },
    saveLostReasons: (lost) => must(sb().from("hq_sales_journey").upsert({ id: 1, lost })),
  },
  // ตั้งค่าของสาขา — แถวเดียวต่อ dealer_code · RLS คุมว่าแก้ได้เฉพาะของตัวเอง
  // เก็บเป็น jsonb ราย "กลุ่ม" จึงไม่ต้องแปลง snake/camel ข้างใน (ปล่อยผ่านทั้งก้อน)
  dealerSettings: {
    get: async (dealerCode) => {
      const { data, error } = await sb().from("dealer_settings")
        .select("issuer,document,wordmark,logo,notif_prefs").eq("dealer_code", dealerCode).maybeSingle();
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as Record<string, unknown>;
      // ยังไม่เคยตั้งค่า = คืนค่ากลาง (หน้าจอจะได้มีอะไรให้แก้ ไม่ใช่ฟอร์มว่างเปล่า)
      return {
        issuer:     { ...DEFAULT_ISSUER, ...(r.issuer as object ?? {}) },
        document:   { ...DEFAULT_DOC, ...(r.document as object ?? {}) },
        wordmark:   (r.wordmark as string) ?? "",
        logo:       (r.logo as string) ?? "",
        notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...(r.notif_prefs as object ?? {}) },
      } as DealerSettings;
    },
    save: async (dealerCode, patch) => {
      const row: Row = { dealer_code: dealerCode, updated_at: new Date().toISOString() };
      if (patch.issuer)                 row.issuer = patch.issuer;
      if (patch.document)               row.document = patch.document;
      if (patch.wordmark !== undefined) row.wordmark = patch.wordmark;
      if (patch.logo !== undefined)     row.logo = patch.logo;
      if (patch.notifPrefs)             row.notif_prefs = patch.notifPrefs;
      await must(sb().from("dealer_settings").upsert(row, { onConflict: "dealer_code" }));
    },
  },
  // โปรไฟล์ของผู้ใช้ที่ล็อกอิน — แถวใน profiles ที่ id ตรงกับ auth user
  // อีเมลล็อกอินอยู่ใน auth.users (แก้จากที่นี่ไม่ได้) · contact_email = อีเมลติดต่อที่ผู้ใช้ตั้งเอง
  profile: {
    get: async () => {
      // getSession() อ่าน session จากเครื่อง — ห้ามใช้ getUser() ที่ยิง /auth/v1/user ทุกครั้ง
      // (hook นี้ทำงานทุกหน้าผ่าน Sidebar/Topbar → คำขอถูกยกเลิกตอนเปลี่ยนหน้า
      //  แล้วโผล่เป็น console error "Failed to fetch" เป็นร้อยรายการ)
      const { data: sess } = await sb().auth.getSession();
      const id = sess.session?.user?.id;
      if (!id) return null;
      const { data, error } = await sb().from("profiles")
        .select("name,phone,contact_email,avatar").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const r = data as Record<string, unknown>;
      return {
        name: (r.name as string) ?? "",
        email: ((r.contact_email as string) || sess.session?.user?.email) ?? "",
        phone: (r.phone as string) ?? "",
        avatar: (r.avatar as string) || undefined,
      } as UserProfile;
    },
    save: async (p) => {
      const { data: sess } = await sb().auth.getSession();
      const id = sess.session?.user?.id;
      if (!id) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
      // อัปเดตเฉพาะฟิลด์ส่วนตัว — role/dealer_code ไม่ส่งไป (และ trigger ที่ DB กันไว้อีกชั้น)
      await must(sb().from("profiles")
        .update({ name: p.name, phone: p.phone, contact_email: p.email, avatar: p.avatar ?? null })
        .eq("id", id));
    },
  },
  hqCompany: {
    get: async () => (await one<HQCompany>("hq_company")) ?? EMPTY_HQ_COMPANY,
    save: (c) => must(sb().from("hq_company").upsert({ id: 1, ...toSnake(c as unknown as Row) })),
  },
  notes: {
    list: (scope) => selectScoped<CustomerNote>("customer_notes", scope),
    create: (n) => insertRow<CustomerNote>("customer_notes", n as CustomerNote),
    update: (n) => updateRow<CustomerNote>("customer_notes", n.id, n),
    remove: (id) => must(sb().from("customer_notes").delete().eq("id", id)),
  },
  users: {
    list: async () => {
      // อีเมลล็อกอินอยู่ใน auth.users ซึ่ง client อ่านไม่ได้ (ต้อง service_role)
      // → แสดง contact_email ที่ผู้ใช้ตั้งเอง ไม่มีก็ขึ้น "—" ไม่กุอีเมลขึ้นมา
      const rows = await pageAll((from, to) =>
        sb().from("profiles").select("*").order("created_at", { ascending: true }).range(from, to), "profiles");
      return rows.map(r => ({
        id: String(r.id),
        name: (r.name as string) || "",
        email: (r.contact_email as string) || "",
        phone: (r.phone as string) || "",
        role: (r.role as string) || "",
        department: (r.department as string) || "",
        dealerCode: (r.dealer_code as string) || "",
        status: ((r.status as string) === "inactive" ? "inactive" : "active") as SystemUser["status"],
        createdAt: (r.created_at as string) || "",
        avatar: (r.avatar as string) || undefined,
      }));
    },
    update: (u) => must(sb().from("profiles")
      .update({ name: u.name, role: u.role, department: u.department, status: u.status })
      .eq("id", u.id)),
    // สร้าง/ลบบัญชีต้องใช้ service_role — ห้ามอยู่ฝั่ง client เด็ดขาด
    canCreate: () => false,
  },
  audit: {
    // อ่านล่าสุดสูงสุด limit รายการ (id desc) + แปลง at (timestamptz) → สตริงไทยที่ /hq/audit (parseDate) เข้าใจ
    // audit_log เป็นตาราง append-only ที่โตไม่จำกัด (ทุก action ของ HQ ตลอดกาล) — เดิม pageAll ดึงทั้งหมด
    // จึงมีเพดานอ่านเสมอ (M8) · หน้า /hq/audit แจ้งผู้ใช้เมื่อชนเพดาน (ไม่ตัดเงียบ)
    list: async (limit = 5000) => {
      const { data, error } = await sb().from("audit_log")
        .select("*").order("id", { ascending: false }).range(0, Math.max(0, limit - 1));
      if (error) throw new Error(error.message);
      return (data as Row[]).map(r => ({ ...toCamel<AuditEntry>(r), at: fmtAuditAt(String(r.at)) }));
    },
    // ประทับ at ด้วย "วันนี้ของระบบ" (APP_NOW) + เวลาจริง → รายการอยู่ในช่วงตัวกรอง /hq/audit (แช่แข็งเวลา)
    append: (e) => {
      const t = new Date();
      const at = new Date(APP_NOW.getFullYear(), APP_NOW.getMonth(), APP_NOW.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
      return must(sb().from("audit_log").insert({ ...toSnake(e as unknown as Row), at: at.toISOString() }));
    },
  },

  // rollup รายสาขา (M9 Phase 1) — รวมยอดที่ DB ผ่าน RPC dealer_rollup · RLS คุม scope (ตัวแทน=สาขาตน · HQ=ทั้งเครือ)
  metrics: {
    dealerRollup: async (year, opts) => {
      const { data, error } = await sb().rpc("dealer_rollup", {
        p_year: year,
        p_as_of: opts?.asOf ?? "2026-06-30",
        p_default_days: opts?.defaultDays ?? 7,
        p_follow_up_days: opts?.perDealer ?? null,
      });
      if (error) throw new Error(error.message);
      const m = new Map<string, DealerRollup>();
      for (const r of (data as Row[]) ?? []) {
        m.set(String(r.dealer_code), {
          quotes: Number(r.quotes), won: Number(r.won), lost: Number(r.lost),
          revenue: Number(r.revenue), openLeads: Number(r.open_leads), staleLeads: Number(r.stale_leads),
        });
      }
      return m;
    },
    leadSummary: async (f) => {
      const { data, error } = await sb().rpc("lead_summary", {
        p_dealer_codes: f.dealerCodes ?? null, p_province: f.province ?? null, p_product: f.product ?? null,
        p_source: f.source ?? null, p_search: (f.search ?? "").trim() || null, p_status: f.status ?? null,
        p_date_start: f.dateStart ?? null, p_date_end: f.dateEnd ?? null,
      });
      if (error) throw new Error(error.message);
      const d = (data ?? {}) as { byStatus?: Row[]; bySource?: Row[]; byProduct?: Row[]; byLostReason?: Row[]; byMonth?: Row[] };
      return {
        byStatus: (d.byStatus ?? []).map(r => ({ status: String(r.status), count: Number(r.count) })),
        bySource: (d.bySource ?? []).map(r => ({ source: String(r.source), count: Number(r.count) })),
        byProduct: (d.byProduct ?? []).map(r => ({ product: String(r.product), count: Number(r.count) })),
        byLostReason: (d.byLostReason ?? []).map(r => ({ reason: String(r.reason), count: Number(r.count) })),
        byMonth: (d.byMonth ?? []).map(r => ({ y: Number(r.y), m: Number(r.m), created: Number(r.new), won: Number(r.won), lost: Number(r.lost) })),
      };
    },
    customerRollup: async () => {
      const { data, error } = await sb().rpc("customer_rollup");
      if (error) throw new Error(error.message);
      const m = new Map<string, WonBuildingRaw[]>();
      for (const r of (data as Row[]) ?? []) {
        m.set(`${r.dealer_code}|${r.customer ?? ""}`, ((r.buildings as WonBuildingRaw[]) ?? []).map(b => ({
          quoteNo: String(b.quoteNo), productLine: String(b.productLine ?? ""), valueNum: Number(b.valueNum), date: String(b.date ?? ""),
        })));
      }
      return m;
    },
    networkQuoteRange: async (start, end, dealer) => {
      const { data, error } = await sb().rpc("network_quote_range", { p_start: start, p_end: end, p_dealer: dealer ?? null });
      if (error) throw new Error(error.message);
      const m = new Map<string, QuoteRangeRow>();
      for (const r of (data as Row[]) ?? []) {
        m.set(String(r.dealer_code), {
          quotes: Number(r.quotes), won: Number(r.won), lost: Number(r.lost),
          wonVal: Number(r.won_val), quoteVal: Number(r.quote_val),
        });
      }
      return m;
    },
    dashboardQuoteSummary: async (start, end, dealer) => {
      const { data, error } = await sb().rpc("dashboard_quote_summary", { p_start: start, p_end: end, p_dealer: dealer ?? null });
      if (error) throw new Error(error.message);
      const d = (data ?? {}) as { byMonth?: Row[]; byStatus?: Row[]; byProduct?: Row[] };
      return {
        byMonth: (d.byMonth ?? []).map(r => ({
          y: Number(r.y), m: Number(r.m), quotes: Number(r.quotes),
          won: Number(r.won), lost: Number(r.lost), wonVal: Number(r.won_val),
        })),
        byStatus: (d.byStatus ?? []).map(r => ({ status: String(r.status), count: Number(r.count), value: Number(r.value) })),
        byProduct: (d.byProduct ?? []).map(r => ({ product: (r.product as string) ?? null, value: Number(r.value), projects: Number(r.projects) })),
      };
    },
    hqQuotationsSummary: async (f) => {
      const { data, error } = await sb().rpc("hq_quotations_summary", {
        p_status: f.status ?? null, p_dealer_codes: f.dealerCodes ?? null, p_product_lines: f.productLines ?? null,
        p_search: (f.search ?? "").trim() || null, p_date_start: f.dateStart ?? null, p_date_end: f.dateEnd ?? null,
        p_as_of: f.asOf ?? "2026-06-30", p_search_dealers: f.searchDealers ?? null,
      });
      if (error) throw new Error(error.message);
      const d = (data ?? {}) as { byDealer?: Row[]; byMonth?: Row[]; byProduct?: Row[]; aging?: Row[] };
      return {
        byDealer: (d.byDealer ?? []).map(r => ({
          dealerCode: String(r.dealer_code), count: Number(r.count), value: Number(r.value),
          sent: Number(r.sent), won: Number(r.won), lost: Number(r.lost), wonVal: Number(r.won_val),
        })),
        byMonth: (d.byMonth ?? []).map(r => ({
          y: Number(r.y), m: Number(r.m), quotes: Number(r.quotes), won: Number(r.won), lost: Number(r.lost), wonVal: Number(r.won_val),
        })),
        byProduct: (d.byProduct ?? []).map(r => ({ product: (r.product as string) ?? null, value: Number(r.value), projects: Number(r.projects) })),
        aging: (d.aging ?? []).map(r => ({ bucket: String(r.bucket), count: Number(r.count), value: Number(r.value) })),
      };
    },
  },

  // งานขาย — RLS ที่ DB คุมขอบเขต (insert ต้องมี dealer_code = สาขา session · with-check)
  // leads ใช้ mapper เฉพาะ (leadToRow/rowToLead) เพราะ id เป็น text + createdAt/area ต้องแปลงพิเศษ
  leads: {
    list: async (scope) => {
      const rows = await pageAll((from, to) => {
        const base = sb().from("leads").select("*").order("id", { ascending: true }).range(from, to);
        return scope && !scope.isHQ && scope.dealerCode ? base.eq("dealer_code", scope.dealerCode) : base;
      }, "leads");
      return rows.map(rowToLead);
    },
    nextNumId: (dealerCode) => nextEntityId(dealerCode, "leads"),
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
      }, "quotations");
      return rows.map(rowToQuote);
    },
    // หน้าเดียว + กรอง/เรียง ที่ DB (M9 Phase 2) — RLS คุม scope · derived filter ถูก resolve เป็นคอลัมน์จริงมาแล้ว
    listPage: async (scope, opts) => {
      const s = (opts.search ?? "").trim().replace(/[,()%*\\]/g, " ").trim(); // กันตัวอักษรที่ทำ or() พัง
      let q = sb().from("quotations").select("*", { count: "exact" });
      if (scope && !scope.isHQ && scope.dealerCode) q = q.eq("dealer_code", scope.dealerCode);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.dealerCodes?.length) q = q.in("dealer_code", opts.dealerCodes);
      if (opts.productLines?.length) q = q.in("product_line", opts.productLines);
      if (opts.dateStart) q = q.gte("date", opts.dateStart);
      if (opts.dateEnd) q = q.lte("date", opts.dateEnd);
      if (s) {
        const parts = [`id.ilike.%${s}%`, `customer.ilike.%${s}%`];
        if (opts.searchDealers?.length) parts.push(`dealer_code.in.(${opts.searchDealers.join(",")})`);
        q = q.or(parts.join(","));
      }
      const col = opts.sort?.col ?? "date", asc = (opts.sort?.dir ?? "desc") === "asc";
      q = q.order(col, { ascending: asc }).order("id", { ascending: true }).range(opts.offset, opts.offset + opts.limit - 1);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { rows: (data as Row[]).map(rowToQuote), total: count ?? 0 };
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
    // ออกเลข + insert รวด (atomic) — RPC ที่ DB (0034) · insert ล้ม = ตัวนับ rollback ไม่เดิน (H8)
    createNumbered: async (dealer, prefix, row) => {
      const payload = quoteToRow(row as unknown as QuotationMock);
      delete payload.id; delete payload.created_at; delete payload.dealer_code; // DB เป็นคนออกให้
      const { data, error } = await sb().rpc("create_quotation", {
        p_dealer: dealer, p_prefix: prefix ?? "Q-2026-", p_payload: payload,
      });
      if (error) throw new Error(error.message);
      return rowToQuote(data as Row);
    },
    // เลขที่ใบต่อสาขาแบบ atomic (กันเลขชนเมื่อออกพร้อมกัน/ข้ามสาขา) — RPC ที่ DB (0003)
    nextQuoteNo: async (dealer, prefix) => {
      // ตัวนับเดินหน้าใน DB แบบ atomic ต่อสาขา · คำนำหน้าเป็นของตัวแทน (ส่งมาจากผู้เรียก)
      // ไม่ส่ง p_prefix = ฟังก์ชันใช้ค่า default ของมันเอง → คำนำหน้าที่ตัวแทนตั้งไว้จะถูกละเลย
      const args: Record<string, unknown> = { p_dealer: dealer };
      if (prefix) args.p_prefix = prefix;
      const { data, error } = await sb().rpc("next_quote_no", args);
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
      }, "appointments");
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
