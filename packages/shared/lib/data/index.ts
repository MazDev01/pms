// Data Layer — จุดเข้าเดียวของทุกการอ่าน/เขียนข้อมูล
//
// กติกา: หน้า/component ห้ามเรียก localStorage หรือ import mock.ts ตรง ๆ อีก
//         ให้เรียกผ่าน repository เหล่านี้เท่านั้น → สลับ backend ได้ด้วย ENV ตัวเดียว
//
//   import { dealers, leads, audit } from "@pms/shared/lib/data";
//   const rows = await dealers.list();
//
// สถานะ (18 ส.ค. 69): ครบทั้งสามเส้นทาง — LocalAdapter (เดโม) · SupabaseAdapter (ที่ใช้จริงตอนนี้)
//   · HttpAdapter (ผ่าน backend ของเราเอง · ย้ายครบ 18 พอร์ตแล้ว รอสลับใช้จริง)
import { DATA_SOURCE } from "./config";
import { LocalAdapter } from "./local/LocalAdapter";
import { SupabaseAdapter } from "./supabase/SupabaseAdapter";
import { HttpAdapter } from "./http/HttpAdapter";
import { dedupeRead, ttlCacheRead, invalidateCache } from "./dedupe";

// TTL ของแคชข้อมูลอ้างอิง (ทะเบียนตัวแทน/แคตตาล็อก/กฎธุรกิจ/ผู้รับผิดชอบ) — สั้นพอที่ผู้ใช้จะไม่รู้สึกว่า
// ข้อมูลค้าง (แก้เองก็ invalidate ทันทีอยู่แล้ว) ยาวพอที่จะตัดคำขอซ้ำตอนสลับหน้าไปมาเร็ว ๆ
const REF_TTL_MS = 30_000;
import type { DataAdapter, DealersRepo, CatalogRepo, SettingsRepo, MetricsRepo, PersonsRepo, DealerSettingsRepo, AuditRepo, ProfileRepo } from "./ports";

// "api" = คุยผ่าน backend ของเราเอง (ครบทุกพอร์ตแล้ว · ดู http/HttpAdapter.ts และ docs/BACKEND-MIGRATION.md)
const adapter: DataAdapter =
  DATA_SOURCE === "supabase" ? SupabaseAdapter
  : DATA_SOURCE === "api" ? HttpAdapter
  : LocalAdapter;

export const storage = adapter.storage;   // ไฟล์จริง (bytes) — local: no-op · supabase: Storage
export const realtime = adapter.realtime; // ฟังการเปลี่ยนแปลงสด — local: no-op · supabase: postgres_changes

// ── H7 · รวมคำขออ่านที่ไม่มีพารามิเตอร์ ให้ยิงจริงครั้งเดียวเมื่อเกิดพร้อมกัน (in-flight dedup) ──
// จุดเดียวครอบทุก caller · เฉพาะ read ที่ "ไม่มี arg" (การเขียน/read ที่มี scope ไม่แตะ · ดู dedupe.ts)
// เดิม dedupeRead อย่างเดียว (รวมแค่คำขอที่ค้างพร้อมกัน) — ยังยิงซ้ำทุกครั้งที่เปลี่ยนหน้าเพราะคำขอ
// ก่อนหน้า "settle" ไปแล้วเสมอกว่าจะเปิดหน้าถัดไป ตอนนี้ใช้ ttlCacheRead แทน (แคชจริง 30s) + invalidate
// ทันทีที่มีการเขียน ให้ผู้ใช้เห็นข้อมูลใหม่ทันทีแม้ยังไม่ครบ TTL (พบจากผลตรวจสอบระบบรอบ 2, 31 ก.ค. 69)
const _dealers = adapter.dealers, _catalog = adapter.catalog, _settings = adapter.settings;
export const dealers: DealersRepo = {
  ..._dealers,
  list: () => ttlCacheRead("dealers.list", () => _dealers.list(), REF_TTL_MS),
  save: async (all) => { await _dealers.save(all); invalidateCache("dealers.list"); },
  remove: async (code) => { await _dealers.remove(code); invalidateCache("dealers.list"); },
};
export const catalog: CatalogRepo = {
  ..._catalog,
  list: () => ttlCacheRead("catalog.list", () => _catalog.list(), REF_TTL_MS),
  save: async (all) => { await _catalog.save(all); invalidateCache("catalog.list"); },
  remove: async (id) => { await _catalog.remove(id); invalidateCache("catalog.list"); },
};
export const settings: SettingsRepo = {
  ..._settings,
  getPolicy:            () => ttlCacheRead("settings.getPolicy", () => _settings.getPolicy(), REF_TTL_MS),
  getTargets:           () => ttlCacheRead("settings.getTargets", () => _settings.getTargets(), REF_TTL_MS),
  getNotifRules:        () => ttlCacheRead("settings.getNotifRules", () => _settings.getNotifRules(), REF_TTL_MS),
  getLeadRulesMap:      () => ttlCacheRead("settings.getLeadRulesMap", () => _settings.getLeadRulesMap(), REF_TTL_MS),
  getQuoteValidityDays: () => ttlCacheRead("settings.getQuoteValidityDays", () => _settings.getQuoteValidityDays(), REF_TTL_MS),
  getLostReasons:       () => ttlCacheRead("settings.getLostReasons", () => _settings.getLostReasons(), REF_TTL_MS),
  getLeadTasks:         () => ttlCacheRead("settings.getLeadTasks", () => _settings.getLeadTasks(), REF_TTL_MS),
  saveLeadTasks:        async (tasks) => { await _settings.saveLeadTasks(tasks); invalidateCache("settings.getLeadTasks"); },
  saveLeadRules:        async (dealerCode, rules) => { await _settings.saveLeadRules(dealerCode, rules); invalidateCache("settings.getLeadRulesMap"); },
  saveLostReasons:      async (lost) => { await _settings.saveLostReasons(lost); invalidateCache("settings.getLostReasons"); },
  savePolicy:           async (policy) => { await _settings.savePolicy(policy); invalidateCache("settings.getPolicy"); },
  saveTargets:          async (targets) => { await _settings.saveTargets(targets); invalidateCache("settings.getTargets"); },
  saveNotifRules:       async (rules) => { await _settings.saveNotifRules(rules); invalidateCache("settings.getNotifRules"); },
};
export const files = adapter.files;
// Sidebar + Topbar (ทั้งสองคอมโพเนนต์อยู่ยาวทุกหน้า) ต่างเรียก persons/dealerSettings/audit เองอิสระ
// ไม่มีจุดแชร์ผล → เปิดหน้าเดียวยิงซ้ำ 2-6 รอบ (พบจากผลตรวจสอบระบบ 30 ก.ค. 69) · แพตเทิร์นเดียวกับ H7 ข้างบน
const _persons = adapter.persons, _dealerSettings = adapter.dealerSettings, _audit = adapter.audit;
export const persons: PersonsRepo = {
  ..._persons,
  list: (scope) => ttlCacheRead(`persons.list:${JSON.stringify(scope ?? null)}`, () => _persons.list(scope), REF_TTL_MS),
  save: async (all, dealerCode) => {
    await _persons.save(all, dealerCode);
    // ไม่รู้ scope object เป๊ะที่ผู้เรียกอื่นใช้ตอน list() (isHQ ต่างกัน) — ล้างทั้งแคชปลอดภัยกว่า
    invalidateCache();
  },
};
export const dealerSettings: DealerSettingsRepo = {
  ..._dealerSettings,
  get: (dealerCode) => ttlCacheRead(`dealerSettings.get:${dealerCode}`, () => _dealerSettings.get(dealerCode), REF_TTL_MS),
  save: async (dealerCode, patch) => { await _dealerSettings.save(dealerCode, patch); invalidateCache(`dealerSettings.get:${dealerCode}`); },
};
// Sidebar + Topbar เรียก useUserProfile() แยกอิสระคนละอินสแตนซ์ → profile.get() ยิงซ้ำพร้อมกันทุกครั้งที่
// session เปลี่ยน (ล็อกอิน/รีเฟรชหน้า) — พบจากผลตรวจสอบระบบ 30 ก.ค. 69 (High) · แพตเทิร์นเดียวกับ H7 ข้างบน
const _profile = adapter.profile;
export const profile: ProfileRepo = {
  ..._profile,
  get: () => dedupeRead("profile.get", () => _profile.get()),
};
export const hqCompany = adapter.hqCompany;
export const notes = adapter.notes;
export const users = adapter.users;
export const audit: AuditRepo = {
  ..._audit,
  list: (limit) => dedupeRead(`audit.list:${limit ?? ""}`, () => _audit.list(limit)),
};
// rollup รายสาขา (M9 Phase 1) — dedup ตามปี: หลาย component (แดชบอร์ด/แจ้งเตือน/กระดิ่ง) ขอปีเดียวกันพร้อมกัน ยิงจริงครั้งเดียว
const _metrics = adapter.metrics;
export const metrics: MetricsRepo = {
  dealerRollup: (year, opts) => dedupeRead(`metrics.dealerRollup:${year}:${opts ? JSON.stringify(opts) : ""}`, () => _metrics.dealerRollup(year, opts)),
  leadSummary: (f) => dedupeRead(`metrics.leadSummary:${JSON.stringify(f)}`, () => _metrics.leadSummary(f)),
  networkQuoteRange: (start, end, dealer) =>
    dedupeRead(`metrics.networkQuoteRange:${start}:${end}:${dealer ?? ""}`, () => _metrics.networkQuoteRange(start, end, dealer)),
  dashboardQuoteSummary: (start, end, dealer) =>
    dedupeRead(`metrics.dashboardQuoteSummary:${start}:${end}:${dealer ?? ""}`, () => _metrics.dashboardQuoteSummary(start, end, dealer)),
  hqQuotationsSummary: (f) =>
    dedupeRead(`metrics.hqQuotationsSummary:${JSON.stringify(f)}`, () => _metrics.hqQuotationsSummary(f)),
  networkCustomerSummary: () => dedupeRead("metrics.networkCustomerSummary", () => _metrics.networkCustomerSummary()),
  unassignedLeads: (f) => dedupeRead(`metrics.unassignedLeads:${JSON.stringify(f)}`, () => _metrics.unassignedLeads(f)),
  hqAlerts: (f) => dedupeRead(`metrics.hqAlerts:${JSON.stringify(f)}`, () => _metrics.hqAlerts(f)),
  hqCustomersPage: (opts) => dedupeRead(`metrics.hqCustomersPage:${JSON.stringify(opts)}`, () => _metrics.hqCustomersPage(opts)),
  hqCustomersFilterOptions: () => dedupeRead("metrics.hqCustomersFilterOptions", () => _metrics.hqCustomersFilterOptions()),
};
export const leads = adapter.leads;
export const quotations = adapter.quotations;
export const customers = adapter.customers;
export const appointments = adapter.appointments;

export type {
  DataAdapter, StoragePort, DealersRepo, CatalogRepo, FilesRepo, PersonsRepo,
  SettingsRepo, AuditRepo, MetricsRepo, DealerRollup, LeadsRepo, QuotationsRepo, CustomersRepo, AppointmentsRepo,
} from "./ports";
export type { Scope } from "./types";
