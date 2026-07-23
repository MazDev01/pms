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
import type { DataAdapter } from "./ports";

const adapter: DataAdapter = DATA_SOURCE === "supabase" ? SupabaseAdapter : LocalAdapter;

export const storage = adapter.storage;   // ไฟล์จริง (bytes) — local: no-op · supabase: Storage
export const realtime = adapter.realtime; // ฟังการเปลี่ยนแปลงสด — local: no-op · supabase: postgres_changes
export const dealers = adapter.dealers;
export const catalog = adapter.catalog;
export const files = adapter.files;
export const persons = adapter.persons;
export const settings = adapter.settings;
export const dealerSettings = adapter.dealerSettings;
export const profile = adapter.profile;
export const hqCompany = adapter.hqCompany;
export const notes = adapter.notes;
export const users = adapter.users;
export const audit = adapter.audit;
export const leads = adapter.leads;
export const quotations = adapter.quotations;
export const customers = adapter.customers;
export const appointments = adapter.appointments;

export type {
  DataAdapter, StoragePort, DealersRepo, CatalogRepo, FilesRepo, PersonsRepo,
  SettingsRepo, AuditRepo, LeadsRepo, QuotationsRepo, CustomersRepo, AppointmentsRepo,
} from "./ports";
export type { Scope } from "./types";
