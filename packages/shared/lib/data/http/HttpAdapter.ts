// HttpAdapter — คุยกับ backend ของเราเอง แทนที่จะยิงเข้าฐานข้อมูลตรง
//
// ── ระยะ 1 ของแผนแยก backend (14–17 ส.ค. 69) ───────────────────────────────────
// ย้ายครบทั้ง 18 กลุ่มงานแล้ว (realtime ปิดท้ายที่ระยะ 3 — สาย SSE จาก backend ของเราเอง)
//
// สามอย่างที่โครงนี้ให้:
//   1. ล็อกสัญญา — TypeScript บังคับว่าอะแดปเตอร์นี้ต้องมีครบทุกเมธอดเหมือน SupabaseAdapter
//      ย้ายไม่ครบแล้วลืม จะรู้ตั้งแต่ตอนคอมไพล์ ไม่ใช่ตอนผู้ใช้กดแล้วพัง
//   2. ย้ายทีละกลุ่มได้ — แทนที่ทีละพอร์ต (ดู MIGRATED ด้านล่าง)
//   3. ไม่แตะโค้ดหน้าเว็บเลย — หน้าเรียกผ่าน repository เหมือนเดิมทุกประการ
//
// ⚠️ ระยะนี้ backend ทำงาน "ในนามผู้ใช้" (ส่งใบผ่านของเขาต่อให้ DB) ไม่ได้ใช้ service_role
//    RLS ทั้ง 72 กฎจึงยังบังคับเหมือนเดิม — ต่างแค่คำขอเดินผ่านเซิร์ฟเวอร์ของเราอีกทอด
// ⚠️ ก่อนเปิดโหมดนี้บนของจริง ดูข้อจำกัดอายุสายอัปเดตสดใน server/v1/events.ts ก่อน
import type {
  DataAdapter, DealersRepo, CatalogRepo, FilesRepo, PersonsRepo, SettingsRepo,
  DealerSettingsRepo, ProfileRepo, HQCompanyRepo, NotesRepo, UsersRepo, AuditRepo,
  MetricsRepo, LeadsRepo, QuotationsRepo, CustomersRepo, AppointmentsRepo,
  StoragePort, RealtimePort,
} from "../ports";
import type {
  SolutionProduct, AuditEntry, DealerRow, ResponsiblePerson, UserProfile, HQCompany, DealerSettings,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap, CustomerNote, DealerFile, SystemUser,
  LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
} from "../types";
import type { DealerRollup, QuoteRangeRow, CustomerDeletionResult } from "../ports";
import {
  DEFAULT_ISSUER, DEFAULT_NOTIF_PREFS, DEFAULT_HQ_POLICY, DEFAULT_HQ_TARGETS, DEFAULT_HQ_NOTIF_RULES,
  LOST_REASONS, LEAD_TASK_TEMPLATE, normalizeLeadTaskTemplate, DEFAULT_LEAD_RULES,
} from "@pms/shared/lib/mock";
import { DbError } from "@pms/shared/lib/friendlyError";
import { reportPartialData } from "@pms/shared/lib/repoLog";
import { onChannel } from "./eventStream";
import { DATA_SOURCE } from "../config";

// ระยะ 4: โหมด api เก็บใบผ่านไว้ใน cookie httpOnly — หน้าเว็บแนบ header เองไม่ได้ (และไม่ต้อง)
const COOKIE_AUTH = DATA_SOURCE === "api";
import { DEFAULT_DOC } from "@pms/shared/lib/quotationPrint";

// ยังไม่เคยตั้งข้อมูลบริษัท = คืนฟอร์มเปล่า (ค่าเดียวกับ SupabaseAdapter — ห้ามใส่ข้อมูลตัวอย่าง)
const EMPTY_HQ_COMPANY: HQCompany = { name: "", address: "", taxId: "", phone: "", email: "", website: "" };
import { APP_NOW, APP_NOW_ISO } from "@pms/shared/context/FilterContext";

/** กลุ่มงานที่ backend รองรับ — ครบทั้ง 18 กลุ่มแล้ว (ระยะ 1 จบ 17 ส.ค. 69)
 *  ใช้รายงานผ่าน /api/v1/ping เพื่อเช็กว่า backend ที่ deploy อยู่เป็นรุ่นที่ครบจริง */
export const MIGRATED: readonly string[] = [
  "catalog",
  "audit",
  "dealers",
  "persons",
  "profile",
  "hqCompany",
  "dealerSettings",
  "settings",
  "notes",
  "users",
  "files",
  "leads",
  "quotations",
  "customers",
  "appointments",
  "metrics",
  "storage",
  "realtime",
];

// ── ตัวช่วยเรียก backend (ใช้ตอนเริ่มย้ายจริงในระยะ 1) ────────────────────────────
// เส้นทางเป็น relative เสมอ — backend อยู่ในแอปเดียวกัน (Next.js Route Handler)
// จึงไม่มีเรื่อง CORS และคุกกี้/ใบผ่านเดินทางไปกับคำขอเองอัตโนมัติ
export const API_BASE = "/api/v1";

// ใบผ่านของผู้ใช้ที่ล็อกอินอยู่ — backend เอาไปทำงาน "ในนามเขา" ต่อ (RLS จึงยังบังคับเหมือนเดิม)
// อ่านจาก client ตัวเดียวกับที่ระบบล็อกอินใช้ ไม่ได้เก็บสำเนาถาวรไว้เอง
//
// ⚠️ ห้ามเรียก getSession() ทุกคำขอ — วัดแล้วเป็นคอขวดตัวใหญ่ที่สุดของโหมดนี้
//    getSession() จับล็อกร่วม และต่ออายุใบผ่านให้เองถ้าใกล้หมด (= ยิงเน็ตออกไปอีกที)
//    หน้าเดียวขอข้อมูลหลายสิบชุดพร้อมกัน ทุกคำขอจึงไปเข้าคิวรอกันเป็นทอด ๆ
//    ของจริงที่วัดได้: บางหน้าใช้เวลา 2 วินาที → 23 วินาที (ช้าลง 10 เท่า, 18 ส.ค. 69)
//
// เก็บไว้ในหน่วยความจำแล้วใช้ซ้ำจนใกล้หมดอายุ · คำขอที่มาพร้อมกันใช้คำตอบเดียวกัน (ไม่ยิงซ้ำซ้อน)
let tokenCache: { token: string; expiresAtMs: number } | null = null;
let tokenInFlight: Promise<string> | null = null;
const TOKEN_EARLY_MS = 60_000;   // ต่ออายุล่วงหน้า 1 นาที กันใช้ใบที่หมดพอดีระหว่างทาง

async function readTokenFresh(): Promise<string> {
  try {
    const { getSupabase } = await import("../supabase/client");
    const { data } = await getSupabase().auth.getSession();
    const s = data.session;
    if (!s?.access_token) { tokenCache = null; return ""; }
    tokenCache = { token: s.access_token, expiresAtMs: (s.expires_at ?? 0) * 1000 };
    return s.access_token;
  } catch { tokenCache = null; return ""; }
}

/** ล้างใบผ่านที่จำไว้ — ต้องเรียกเมื่อออกจากระบบ/สลับบัญชี ไม่งั้นยังยิงด้วยใบของคนเดิม */
export function forgetCallerToken(): void { tokenCache = null; tokenInFlight = null; }

async function callerToken(): Promise<string> {
  const c = tokenCache;
  if (c && Date.now() < c.expiresAtMs - TOKEN_EARLY_MS) return c.token;
  if (!tokenInFlight) tokenInFlight = readTokenFresh().finally(() => { tokenInFlight = null; });
  return tokenInFlight;
}

// รอใบผ่านสั้น ๆ ก่อนยิง — ตอนเปิดหน้าครั้งแรก session ยังกู้คืนไม่เสร็จ
// ยิงไปเลยจะได้ 401 ทั้งที่ผู้ใช้ล็อกอินอยู่ (เจอจริงตอนทดสอบระยะ 1: /dealers /profile /dealer-settings)
// โหมด supabase ไม่เจอเพราะ client ของมันจัดคิวรอ session ให้เอง
async function tokenReady(): Promise<string> {
  for (let i = 0; i < 20; i++) {                 // รวมไม่เกิน ~2 วินาที
    const t = await callerToken();
    if (t) return t;
    await new Promise(r => setTimeout(r, 100));
  }
  return "";
}

/** ยิงคำขอหนึ่งครั้ง — โหมด cookie ไม่ต้องแนบ header อะไรเลย เบราว์เซอร์ส่ง cookie ให้เอง */
async function once(path: string, init?: RequestInit): Promise<Response> {
  const token = COOKIE_AUTH ? "" : await tokenReady();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await once(path, init);
  // ใบผ่านหมดอายุระหว่างใช้งาน — ต่ออายุที่เซิร์ฟเวอร์แล้วลองใหม่ครั้งเดียว
  // (หน้าเว็บต่ออายุเองไม่ได้แล้ว เพราะไม่มีใบผ่านอยู่ในมือ — นั่นคือเจตนาของระยะ 4)
  if (res.status === 401 && COOKIE_AUTH) {
    const { caRefresh } = await import("@pms/shared/lib/cookieAuth");
    if (await caRefresh()) res = await once(path, init);
  }
  // อ่าน body ก่อนเช็ค ok — ข้อความอธิบายเหตุผลอยู่ใน body ไม่ใช่ status
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | T | null;
  if (!res.ok) {
    // ต้องเป็น DbError พร้อมรหัสของ Postgres — friendlyError ทั้งแอปอ่านรหัสนี้เพื่อแปลงเป็น
    // ข้อความที่คนอ่านรู้เรื่อง (เช่น 23503 = ยังมีข้อมูลอ้างถึงอยู่) . โยน Error เปล่าจะเสียตรงนั้นไป
    const b = body && typeof body === "object" ? body as { error?: string; code?: string } : null;
    throw new DbError(b?.error ? String(b.error) : `เซิร์ฟเวอร์ตอบกลับ ${res.status}`, b?.code);
  }
  return body as T;
}

/** list ทั้งตาราง — เซิร์ฟเวอร์ส่งธง partial มาด้วยเมื่อชนเพดาน ต้องเตือนผู้ใช้ ไม่ใช่ตัดเงียบ */
async function listAll<T>(path: string, label: string, scope?: Scope): Promise<T[]> {
  const r = await apiFetch<{ rows: T[]; partial: boolean }>(`${path}${scopeQ(scope)}`);
  if (r.partial) {
    reportPartialData(`ข้อมูลที่แสดงไม่ครบ — "${label}" มีจำนวนมากเกินกว่าที่ระบบโหลดไหวในครั้งเดียว กรุณาใช้ตัวกรองช่วยแคบผลลัพธ์`);
  }
  return r.rows;
}
const post = <T,>(path: string, payload: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(payload) });
const put = <T,>(path: string, payload: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: JSON.stringify(payload) });

const dealers: DealersRepo = {
  list: () => apiFetch<DealerRow[]>("/dealers"),
  save: async (all) => { await apiFetch("/dealers", { method: "PUT", body: JSON.stringify(all) }); },
  remove: async (code) => { await apiFetch(`/dealers?code=${encodeURIComponent(code)}`, { method: "DELETE" }); },
};
// ── ย้ายแล้ว (ระยะ 1) ──
const catalog: CatalogRepo = {
  list: () => apiFetch<SolutionProduct[]>("/catalog"),
  save: async (all) => { await apiFetch("/catalog", { method: "PUT", body: JSON.stringify(all) }); },
  remove: async (id) => { await apiFetch(`/catalog?id=${encodeURIComponent(id)}`, { method: "DELETE" }); },
};
const scopeQ = (scope?: { isHQ?: boolean; dealerCode?: string }) =>
  scope?.isHQ ? "?hq=1" : scope?.dealerCode ? `?dealer=${encodeURIComponent(scope.dealerCode)}` : "";
const files: FilesRepo = {
  list: (scope) => apiFetch<DealerFile[]>(`/files${scopeQ(scope)}`),
  add: (f) => apiFetch<DealerFile>("/files", { method: "POST", body: JSON.stringify(f) }),
  update: async (f) => { await apiFetch("/files", { method: "PUT", body: JSON.stringify(f) }); },
  remove: async (id) => { await apiFetch(`/files?id=${id}`, { method: "DELETE" }); },
};
const persons: PersonsRepo = {
  list: (scope) => apiFetch<ResponsiblePerson[]>(
    scope?.dealerCode && !scope.isHQ ? `/persons?dealer=${encodeURIComponent(scope.dealerCode)}` : "/persons"),
  save: async (all, dealerCode) => {
    await apiFetch("/persons", { method: "PUT", body: JSON.stringify({ dealerCode, rows: all }) });
  },
};
// เซิร์ฟเวอร์คืน "ดิบ" (null ถ้ายังไม่เคยตั้ง) — ค่ากลางเติมที่นี่ เพราะค่ากลางอยู่ใน mock.ts ฝั่งแอป
const getOne = <T,>(k: string) => apiFetch<T | null>(`/settings?k=${k}`);
const putOne = async (k: string, body: unknown) => {
  await apiFetch(`/settings?k=${k}`, { method: "PUT", body: JSON.stringify(body) });
};
const settings: SettingsRepo = {
  getPolicy: async () => (await getOne<HQPolicy>("policy")) ?? DEFAULT_HQ_POLICY,
  getTargets: async () => (await getOne<HQTargets>("targets")) ?? DEFAULT_HQ_TARGETS,
  getNotifRules: async () => {
    const r = await getOne<HQNotifRules>("notifRules");
    if (!r) return DEFAULT_HQ_NOTIF_RULES;
    return {
      ...DEFAULT_HQ_NOTIF_RULES, ...r,
      alerts:   { ...DEFAULT_HQ_NOTIF_RULES.alerts,   ...(r.alerts   ?? {}) },
      channels: { ...DEFAULT_HQ_NOTIF_RULES.channels, ...(r.channels ?? {}) },
    };
  },
  getLeadRulesMap: async () => {
    const rows = await apiFetch<({ dealerCode: string } & LeadRules)[]>("/settings?k=leadRules");
    const map: DealerLeadRulesMap = {};
    for (const r of rows) map[r.dealerCode] = r;
    return map;
  },
  saveLeadRules: (code, rules) => putOne("leadRules", { dealerCode: code, ...rules }),
  getQuoteValidityDays: async () =>
    (await getOne<HQPolicy>("policy"))?.quoteValidityDays ?? DEFAULT_HQ_POLICY.quoteValidityDays,
  getLostReasons: async () => {
    const row = await getOne<{ lost?: string[] }>("journey");
    return row?.lost?.length ? row.lost : [...LOST_REASONS];
  },
  saveLostReasons: (lost) => putOne("lostReasons", { value: lost }),
  getLeadTasks: async () => {
    const row = await getOne<{ tasks?: unknown }>("journey");
    return Array.isArray(row?.tasks) && row.tasks.length
      ? normalizeLeadTaskTemplate(row.tasks) : [...LEAD_TASK_TEMPLATE];
  },
  saveLeadTasks: (tasks) => putOne("leadTasks", { value: tasks }),
  savePolicy: (p) => putOne("policy", p),
  saveTargets: (t) => putOne("targets", t),
  saveNotifRules: (r) => putOne("notifRules", r),
  restoreSettings: (patch) => putOne("restore", patch),
};
const dealerSettings: DealerSettingsRepo = {
  // เติมค่ากลางที่ฝั่งนี้ — ค่ากลางอยู่ใน mock.ts ซึ่งเป็นของฝั่งแอป ไม่ต้องลากเข้าเซิร์ฟเวอร์
  get: async (dealerCode) => {
    const r = await apiFetch<Record<string, unknown>>(`/dealer-settings?dealer=${encodeURIComponent(dealerCode)}`);
    return {
      issuer:     { ...DEFAULT_ISSUER, ...((r.issuer as object) ?? {}) },
      document:   { ...DEFAULT_DOC, ...((r.document as object) ?? {}) },
      logo:       (r.logo as string) ?? "",
      notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...((r.notif_prefs as object) ?? {}) },
      pricing:    ((r.pricing as object) ?? {}),
    } as DealerSettings;
  },
  save: async (dealerCode, patch) => {
    await apiFetch("/dealer-settings", { method: "PUT", body: JSON.stringify({ dealerCode, patch }) });
  },
};
const profile: ProfileRepo = {
  get: () => apiFetch<UserProfile | null>("/profile"),
  save: async (p) => { await apiFetch("/profile", { method: "PUT", body: JSON.stringify(p) }); },
};
const hqCompany: HQCompanyRepo = {
  // ยังไม่เคยตั้งค่า = คืนค่ากลาง (เหมือน SupabaseAdapter) ไม่ใช่ null ให้หน้าจอไปพังเอง
  get: async () => (await apiFetch<HQCompany | null>("/hq-company")) ?? EMPTY_HQ_COMPANY,
  save: async (c) => { await apiFetch("/hq-company", { method: "PUT", body: JSON.stringify(c) }); },
};
const notes: NotesRepo = {
  list: (scope) => apiFetch<CustomerNote[]>(`/notes${scopeQ(scope)}`),
  create: (n) => apiFetch<CustomerNote>("/notes", { method: "POST", body: JSON.stringify(n) }),
  update: (n) => apiFetch<CustomerNote>("/notes", { method: "PUT", body: JSON.stringify(n) }),
  remove: async (id) => { await apiFetch(`/notes?id=${id}`, { method: "DELETE" }); },
};
const users: UsersRepo = {
  list: () => apiFetch<SystemUser[]>("/users"),
  update: async (u) => { await apiFetch("/users", { method: "PUT", body: JSON.stringify(u) }); },
  // canCreate เป็น sync — ตอบตามความจริงของโหมดนี้ได้เลย ไม่ต้องรอ backend
  // backend ถือ service_role อยู่แล้ว จึงสร้างบัญชีได้ (ต่างจากโหมด supabase ที่ client ทำไม่ได้)
  canCreate: () => true,
};
const audit: AuditRepo = {
  list: (limit) => apiFetch<AuditEntry[]>(`/audit${limit ? `?limit=${limit}` : ""}`),
  // ส่ง "วันนี้ของระบบ" ไปด้วย — โหมด local ตรึงวันไว้ ถ้าปล่อยให้เซิร์ฟเวอร์ใช้เวลาจริง
  // รายการใหม่จะหลุดออกนอกช่วงตัวกรองของหน้า /hq/audit ทันที
  append: async (e) => {
    const t = new Date();
    const at = new Date(APP_NOW.getFullYear(), APP_NOW.getMonth(), APP_NOW.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
    await apiFetch(`/audit?at=${encodeURIComponent(at.toISOString())}`, { method: "POST", body: JSON.stringify(e) });
  },
};
// ── ตัวสรุปตัวเลข — RPC ทั้งหมด ส่งอาร์กิวเมนต์เป็นก้อน JSON ไปที่ /metrics?k=… ──
// ค่ากลาง (วันนี้ของระบบ/เกณฑ์วันเตือน) เติมที่นี่เหมือนที่ SupabaseAdapter เคยทำ — เซิร์ฟเวอร์ไม่เดาแทน
const metric = <T,>(k: string, args: Record<string, unknown> = {}) => post<T>(`/metrics?k=${k}`, args);
const trimmed = (v?: string) => (v ?? "").trim() || null;
const metrics: MetricsRepo = {
  dealerRollup: async (year, opts) => new Map(await metric<[string, DealerRollup][]>("dealerRollup", {
    year, asOf: opts?.asOf ?? APP_NOW_ISO,
    defaultDays: opts?.defaultDays ?? DEFAULT_LEAD_RULES.followUpAlertDays, perDealer: opts?.perDealer ?? null,
  })),
  networkQuoteRange: async (start, end, dealer) =>
    new Map(await metric<[string, QuoteRangeRow][]>("networkQuoteRange", { start, end, dealer: dealer ?? null })),
  leadSummary: (f) => metric("leadSummary", { ...f, search: trimmed(f.search) }),
  dashboardQuoteSummary: (start, end, dealer) => metric("dashboardQuoteSummary", { start, end, dealer: dealer ?? null }),
  // ⚠️ ต้องส่งตัวกรองไปด้วยทุกตัว (แก้ 27 ส.ค. 69) — เดิมส่งก้อนว่าง ทำให้การ์ด "ลูกค้าใหม่ทั้งเครือ"
  //    บนแดชบอร์ดนับลูกค้าทั้งฐานเสมอ ไม่ว่าจะเลือกช่วงเวลาหรือสาขาไหน (เห็นเลข 53 ทั้งที่ปีนี้มี 13)
  networkCustomerSummary: (f) => metric("networkCustomerSummary", {
    dealerCode: f?.dealerCode ?? null, dateStart: f?.dateStart ?? null, dateEnd: f?.dateEnd ?? null,
  }),
  unassignedLeads: (f) => metric("unassignedLeads", {
    ...f, search: trimmed(f.search),
    asOf: f.asOf ?? APP_NOW_ISO, defaultHours: f.defaultHours ?? DEFAULT_LEAD_RULES.unassignedAlertHours,
  }),
  hqAlerts: (f) => metric("hqAlerts", {
    ...f, asOf: f.asOf ?? APP_NOW_ISO,
    unassignedDefaultHours: f.unassignedDefaultHours ?? DEFAULT_LEAD_RULES.unassignedAlertHours,
    leadIdleDays: f.leadIdleDays ?? DEFAULT_HQ_NOTIF_RULES.leadIdleDays,
    quoteValidityDays: f.quoteValidityDays ?? DEFAULT_HQ_POLICY.quoteValidityDays,
    quoteExpiringDays: f.quoteExpiringDays ?? DEFAULT_HQ_NOTIF_RULES.quoteExpiringDays,
    dealerIdleDays: f.dealerIdleDays ?? DEFAULT_HQ_NOTIF_RULES.dealerIdleDays,
  }),
  hqQuotationsSummary: (f) => metric("hqQuotationsSummary", { ...f, search: trimmed(f.search), asOf: f.asOf ?? APP_NOW_ISO }),
  hqCustomersPage: (o) => metric("hqCustomersPage", { ...o, search: trimmed(o.search) }),
  hqCustomersFilterOptions: () => metric("hqCustomersFilterOptions"),
};
// ── งานขาย ──
// scope ส่งไปกับคำขอ (?hq=1 / ?dealer=…) — RLS ที่ DB ยังเป็นด่านจริง อันนี้แค่ไม่ดึงเกินจำเป็น
const leads: LeadsRepo = {
  list: (scope) => listAll<LeadRow>("/leads", "ลูกค้าเป้าหมาย", scope),
  // รายเดียวแบบครบทุกคอลัมน์ (รวม report ที่รายการไม่ดึง) — แผงรายละเอียดเรียกตอนเปิด
  get: (id) => post<LeadRow | null>("/leads?op=get", { id }),
  listPage: (scope, opts) => post("/leads?op=page", {
    ...opts,
    // ไม่ระบุมา = ใช้สาขาของ scope (พฤติกรรมเดิมของ SupabaseAdapter)
    dealerCodes: opts.dealerCodes ?? (scope && !scope.isHQ && scope.dealerCode ? [scope.dealerCode] : null),
    search: trimmed(opts.search),
    asOf: opts.asOf ?? APP_NOW_ISO, defaultDays: opts.defaultDays ?? DEFAULT_LEAD_RULES.followUpAlertDays,
  }),
  nextNumId: (dealerCode) => post("/leads?op=next", { dealerCode }),
  create: (row) => post<LeadRow>("/leads", row),
  update: (row) => put<LeadRow>("/leads", row),
  setStatus: async (id, status) => { await put("/leads?op=status", { id, status }); },
  remove: async (id) => { await apiFetch(`/leads?id=${encodeURIComponent(id)}`, { method: "DELETE" }); },
};
const quotations: QuotationsRepo = {
  list: (scope) => listAll<QuotationMock>("/quotations", "ใบเสนอราคา", scope),
  listPage: (scope, opts) => post(`/quotations?op=page&${scopeQ(scope).slice(1)}`, opts),
  listForCustomer: (customerId, dealerCode) =>
    apiFetch(`/quotations?op=for-customer&customerId=${customerId}&dealer=${encodeURIComponent(dealerCode)}`),
  create: (row) => post<QuotationMock>("/quotations", row),
  createNumbered: (dealer, prefix, row) => post("/quotations?op=numbered", { dealer, prefix, row }),
  update: (row) => put<QuotationMock>("/quotations", row),
  setStatus: async (id, status) => { await put("/quotations?op=status", { id, status }); },
  setStatusReconciled: (id, status) => put("/quotations?op=status-reconciled", { id, status }),
  relinkCustomerQuotes: (dealer, customerId, company, cascadeWon) =>
    post("/quotations?op=relink", { dealer, customerId, company, cascadeWon }),
  salesperson: (quoteId, dealerCode) =>
    apiFetch(`/quotations?op=salesperson&id=${encodeURIComponent(quoteId)}&dealer=${encodeURIComponent(dealerCode)}`),
  expireOverdue: (asOf, _scope, validityDays) =>
    post("/quotations?op=expire", { asOf, validityDays: validityDays ?? DEFAULT_HQ_POLICY.quoteValidityDays }),
  remove: async (id) => { await apiFetch(`/quotations?id=${encodeURIComponent(id)}`, { method: "DELETE" }); },
};
const customers: CustomersRepo = {
  list: (scope) => listAll<CustomerRow>("/customers", "ลูกค้า", scope),
  listPage: (scope, opts) => post(`/customers?op=page&${scopeQ(scope).slice(1)}`, opts),
  nextId: (dealerCode) => post("/customers?op=next", { dealerCode }),
  create: (row) => post<CustomerRow>("/customers", row),
  update: (row) => put<CustomerRow>("/customers", row),
  remove: async (id) => { await apiFetch(`/customers?id=${id}`, { method: "DELETE" }); },
  upsertForCompany: (dealer, row) => post("/customers?op=upsert-company", { dealer, payload: row }),
  reconcileWonTotal: (customerId) => post("/customers?op=reconcile", { customerId }),
  closeWon: ({ dealer, knownCustomerId, leadCompany, targetQuoteId, cascadeWon, customerPayload }) =>
    post("/customers?op=close-won", { dealer, knownCustomerId, leadCompany, targetQuoteId, cascadeWon, payload: customerPayload }),
  deleteCascade: (id) => post<CustomerDeletionResult>("/customers?op=delete-cascade", { customerId: id }),
};
const appointments: AppointmentsRepo = {
  list: (scope) => listAll<AppointmentMock>("/appointments", "นัดหมาย", scope),
  listForDealer: (dealerCode) => apiFetch(`/appointments?op=for-dealer&dealer=${encodeURIComponent(dealerCode)}`),
  listForLead: (leadId, dealerCode) =>
    apiFetch(`/appointments?op=for-lead&lead=${leadId}&dealer=${encodeURIComponent(dealerCode)}`),
  nextId: (dealerCode) => post("/appointments?op=next", { dealerCode }),
  create: (row) => post<AppointmentMock>("/appointments", row),
  update: (row) => put<AppointmentMock>("/appointments", row),
  remove: async (id) => { await apiFetch(`/appointments?id=${id}`, { method: "DELETE" }); },
};
// ไฟล์จริงส่งเป็น multipart ไม่ใช่ JSON — จึงไม่ผ่าน apiFetch (ที่ตั้ง content-type เป็น json ตายตัว)
const storage: StoragePort = {
  upload: async (dealerCode, file) => {
    const form = new FormData();
    form.append("dealerCode", dealerCode);
    form.append("file", file);
    form.append("stamp", String(Date.now()));
    const token = await tokenReady();
    const res = await fetch(`${API_BASE}/storage`, {
      method: "POST", body: form,
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    const b = (await res.json().catch(() => null)) as { error?: string; code?: string } | string | null;
    if (!res.ok) {
      const e = b && typeof b === "object" ? b : null;
      throw new DbError(e?.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}`, e?.code);
    }
    return typeof b === "string" ? b : null;
  },
  signedUrl: (path) => apiFetch<string | null>(`/storage?path=${encodeURIComponent(path)}`),
  remove: async (path) => { await apiFetch(`/storage?path=${encodeURIComponent(path)}`, { method: "DELETE" }); },
};
// ── อัปเดตสด (ระยะ 3) — สายเดียวจาก backend ของเราเอง แล้วแยกแจกตามช่อง ──────────
// เบราว์เซอร์ไม่ต่อ WebSocket ไปหาฐานข้อมูลเองอีกต่อไป · เซิร์ฟเวอร์ต่อแทนในนามผู้ใช้
// (ดู server/v1/events.ts และ http/eventStream.ts)
const realtime: RealtimePort = {
  subscribeSales: (onChange) => onChannel("sales", (c) => { if (c) onChange(c); }),
  subscribeCatalog: (onChange) => onChannel("catalog", () => onChange()),
  subscribeSettings: (onChange) => onChannel("settings", () => onChange()),
  subscribeNotes: (onChange) => onChannel("notes", () => onChange()),
  subscribeDealerSettings: (onChange) => onChannel("dealerSettings", () => onChange()),
};

export const HttpAdapter: DataAdapter = {
  storage, realtime, dealers, catalog, files, persons, settings, dealerSettings,
  profile, hqCompany, notes, users, audit, metrics, leads, quotations, customers, appointments,
};
