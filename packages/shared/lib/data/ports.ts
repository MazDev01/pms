// Ports — สัญญา (interface) ที่ทุก adapter ต้องมี
// context/hook เรียกผ่าน repository เหล่านี้เท่านั้น · เบื้องหลังสลับ adapter ได้
// ทุกเมธอดเป็น async ตั้งแต่แรก → ต่อ network (เฟส B) ไม่ต้องแก้ signature
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
} from "./types";

// ── โดเมนอ้างอิง/ตั้งค่า (ห่อ loader เดิมได้ทันที — Step 0) ──
export interface DealersRepo {
  list(): Promise<DealerRow[]>;
  save(all: DealerRow[]): Promise<void>;
}
export interface CatalogRepo {
  list(): Promise<SolutionProduct[]>;
  save(all: SolutionProduct[]): Promise<void>;
}
export interface FilesRepo {
  list(scope?: Scope): Promise<DealerFile[]>;
  add(f: Omit<DealerFile, "id">): Promise<DealerFile>;
  update(f: DealerFile): Promise<void>;
  remove(id: number): Promise<void>;
}
export interface PersonsRepo {
  list(scope?: Scope): Promise<ResponsiblePerson[]>;
  // แทนที่รายชื่อ "ของสาขานั้น" ทั้งชุด (ตรา dealer_code ให้ · supabase: ลบของสาขาแล้วใส่ใหม่ · RLS dealer-own)
  save(all: ResponsiblePerson[], dealerCode: string): Promise<void>;
}
export interface SettingsRepo {
  getPolicy(): Promise<HQPolicy>;
  getTargets(): Promise<HQTargets>;
  getNotifRules(): Promise<HQNotifRules>;
  getLeadRulesMap(): Promise<DealerLeadRulesMap>;
  saveLeadRules(dealerCode: string, rules: LeadRules): Promise<void>;
  getQuoteValidityDays(): Promise<number>;
  // เขียนนโยบายระดับเครือ (HQ เท่านั้น — RLS is_hq ฝั่ง supabase · singleton id=1)
  savePolicy(policy: HQPolicy): Promise<void>;
  saveTargets(targets: HQTargets): Promise<void>;
  saveNotifRules(rules: HQNotifRules): Promise<void>;
}
export interface AuditRepo {
  list(): Promise<AuditEntry[]>;
  append(e: Omit<AuditEntry, "id" | "at">): Promise<void>;
}

// ── โดเมนงานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) ──
// write ทุกตัว implement ทั้ง LocalAdapter (localStorage) และ SupabaseAdapter (insert/update/delete)
// ฝั่ง Supabase: dealer_code ต้องตรงสาขา session (บังคับด้วย RLS with-check ที่ DB)
export interface LeadsRepo {
  list(scope?: Scope): Promise<LeadRow[]>;
  create(row: LeadRow): Promise<LeadRow>;
  update(row: LeadRow): Promise<LeadRow>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: LeadRow["status"]): Promise<void>;
}
export interface QuotationsRepo {
  list(scope?: Scope): Promise<QuotationMock[]>;
  create(row: QuotationMock): Promise<QuotationMock>;
  update(row: QuotationMock): Promise<QuotationMock>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: QuotationMock["status"]): Promise<void>;
  nextQuoteNo(dealer: string): Promise<string>; // เลขที่ใบต่อสาขาแบบ atomic (supabase=RPC · local=max+1)
}
export interface CustomersRepo {
  list(scope?: Scope): Promise<CustomerRow[]>;
  create(row: CustomerRow): Promise<CustomerRow>;
  update(row: CustomerRow): Promise<CustomerRow>;
  remove(id: number): Promise<void>;
}
export interface AppointmentsRepo {
  list(scope?: Scope): Promise<AppointmentMock[]>;
  create(row: AppointmentMock): Promise<AppointmentMock>;
  update(row: AppointmentMock): Promise<AppointmentMock>;
  remove(id: number): Promise<void>;
}

// ── ไฟล์จริง (bytes) ใน Supabase Storage — bucket dealer-files/{dealerCode}/... ──
// โหมด local ไม่มี Storage → upload/signedUrl คืน null (เก็บแค่ metadata เหมือนเดิม · หน้าจอต้องรองรับ null)
export interface StoragePort {
  upload(dealerCode: string, file: File): Promise<string | null>; // คืน storagePath
  signedUrl(path: string): Promise<string | null>;                // ลิงก์ดาวน์โหลดชั่วคราว
  remove(path: string): Promise<void>;
}

// ── Realtime — ฟังการเปลี่ยนแปลงของตารางงานขายข้ามเครื่อง (supabase) ──
// โหมด local ไม่มี Realtime → subscribe คืนฟังก์ชันเปล่า (ยังใช้ event bus ของ localStorage เหมือนเดิม)
export type SalesTable = "leads" | "quotations" | "customers" | "appointments";
export interface RealtimePort {
  /** เรียก onChange(table) ทุกครั้งที่ตารางนั้นเปลี่ยน (RLS กรองให้แล้ว) · คืนฟังก์ชัน unsubscribe */
  subscribeSales(onChange: (table: SalesTable) => void): () => void;
}

// ── รวมทุก repository เป็น adapter เดียว ──
export interface DataAdapter {
  storage: StoragePort;
  realtime: RealtimePort;
  dealers: DealersRepo;
  catalog: CatalogRepo;
  files: FilesRepo;
  persons: PersonsRepo;
  settings: SettingsRepo;
  audit: AuditRepo;
  leads: LeadsRepo;
  quotations: QuotationsRepo;
  customers: CustomersRepo;
  appointments: AppointmentsRepo;
}
