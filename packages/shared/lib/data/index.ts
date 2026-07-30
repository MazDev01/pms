// Data Layer — จุดเข้าเดียวของทุกการอ่าน/เขียนข้อมูล
//
// กติกา: หน้า/component ห้ามเรียก localStorage หรือ import mock.ts ตรง ๆ อีก
//         ให้เรียกผ่าน repository เหล่านี้เท่านั้น → สลับ backend ได้ด้วย ENV ตัวเดียว
//
//   import { dealers, leads, audit } from "@pms/shared/lib/data";
//   const rows = await dealers.list();
//
// สถานะ: Step 0 (จัดบ้าน) — LocalAdapter ห่อ loader เดิม · SupabaseAdapter เป็นโครงว่าง (เฟส B)
import { DATA_SOURCE } from "./config";
import { LocalAdapter } from "./local/LocalAdapter";
import { SupabaseAdapter } from "./supabase/SupabaseAdapter";
import { dedupeRead } from "./dedupe";
import type { DataAdapter, DealersRepo, CatalogRepo, SettingsRepo, MetricsRepo, PersonsRepo, DealerSettingsRepo, AuditRepo, ProfileRepo } from "./ports";

const adapter: DataAdapter = DATA_SOURCE === "supabase" ? SupabaseAdapter : LocalAdapter;

export const storage = adapter.storage;   // ไฟล์จริง (bytes) — local: no-op · supabase: Storage
export const realtime = adapter.realtime; // ฟังการเปลี่ยนแปลงสด — local: no-op · supabase: postgres_changes

// ── H7 · รวมคำขออ่านที่ไม่มีพารามิเตอร์ ให้ยิงจริงครั้งเดียวเมื่อเกิดพร้อมกัน (in-flight dedup) ──
// จุดเดียวครอบทุก caller · เฉพาะ read ที่ "ไม่มี arg" (การเขียน/read ที่มี scope ไม่แตะ · ดู dedupe.ts)
const _dealers = adapter.dealers, _catalog = adapter.catalog, _settings = adapter.settings;
export const dealers: DealersRepo = {
  ..._dealers,
  list: () => dedupeRead("dealers.list", () => _dealers.list()),
};
export const catalog: CatalogRepo = {
  ..._catalog,
  list: () => dedupeRead("catalog.list", () => _catalog.list()),
};
export const settings: SettingsRepo = {
  ..._settings,
  getPolicy:            () => dedupeRead("settings.getPolicy", () => _settings.getPolicy()),
  getTargets:           () => dedupeRead("settings.getTargets", () => _settings.getTargets()),
  getNotifRules:        () => dedupeRead("settings.getNotifRules", () => _settings.getNotifRules()),
  getLeadRulesMap:      () => dedupeRead("settings.getLeadRulesMap", () => _settings.getLeadRulesMap()),
  getQuoteValidityDays: () => dedupeRead("settings.getQuoteValidityDays", () => _settings.getQuoteValidityDays()),
  getLostReasons:       () => dedupeRead("settings.getLostReasons", () => _settings.getLostReasons()),
};
export const files = adapter.files;
// Sidebar + Topbar (ทั้งสองคอมโพเนนต์อยู่ยาวทุกหน้า) ต่างเรียก persons/dealerSettings/audit เองอิสระ
// ไม่มีจุดแชร์ผล → เปิดหน้าเดียวยิงซ้ำ 2-6 รอบ (พบจากผลตรวจสอบระบบ 30 ก.ค. 69) · แพตเทิร์นเดียวกับ H7 ข้างบน
const _persons = adapter.persons, _dealerSettings = adapter.dealerSettings, _audit = adapter.audit;
export const persons: PersonsRepo = {
  ..._persons,
  list: (scope) => dedupeRead(`persons.list:${JSON.stringify(scope ?? null)}`, () => _persons.list(scope)),
};
export const dealerSettings: DealerSettingsRepo = {
  ..._dealerSettings,
  get: (dealerCode) => dedupeRead(`dealerSettings.get:${dealerCode}`, () => _dealerSettings.get(dealerCode)),
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
  customerRollup: () => dedupeRead("metrics.customerRollup", () => _metrics.customerRollup()),
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
