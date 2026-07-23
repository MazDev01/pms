// Ports — สัญญา (interface) ที่ทุก adapter ต้องมี
// context/hook เรียกผ่าน repository เหล่านี้เท่านั้น · เบื้องหลังสลับ adapter ได้
// ทุกเมธอดเป็น async ตั้งแต่แรก → ต่อ network (เฟส B) ไม่ต้องแก้ signature
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
  DealerSettings, UserProfile, HQCompany, CustomerNote, SystemUser,
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
  /** เหตุผล "ปิดการขายไม่สำเร็จ" ที่ HQ ตั้ง — ตัวแทนใช้ร่วมกันทั้งเครือ (เขียนได้เฉพาะ HQ) */
  getLostReasons(): Promise<string[]>;
  saveLostReasons(lost: string[]): Promise<void>;
  // เขียนนโยบายระดับเครือ (HQ เท่านั้น — RLS is_hq ฝั่ง supabase · singleton id=1)
  savePolicy(policy: HQPolicy): Promise<void>;
  saveTargets(targets: HQTargets): Promise<void>;
  saveNotifRules(rules: HQNotifRules): Promise<void>;
}
// ── ตั้งค่าของตัวแทนแต่ละสาขา (หัวกระดาษ/เอกสาร/โลโก้/แจ้งเตือน) ──
// เดิมอยู่ใน localStorage ของเครื่องที่ใช้ → ล้างเบราว์เซอร์/ย้ายเครื่องแล้วหาย
// เจ้าของคือ "สาขา" ไม่ใช่ผู้ใช้คนใดคนหนึ่ง · HQ อ่านได้แต่แก้ไม่ได้ (RLS ที่ DB บังคับ)
export interface DealerSettingsRepo {
  get(dealerCode: string): Promise<DealerSettings>;
  /** บันทึกเฉพาะกลุ่มที่ส่งมา (patch) — ไม่ต้องส่งครบทุกกลุ่ม */
  save(dealerCode: string, patch: Partial<DealerSettings>): Promise<void>;
}

// ── โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ (ชื่อ/เบอร์/อีเมลติดต่อ/รูป) ──
// เดิมอยู่ใน localStorage และผูกกับ "สาขา" ไม่ใช่ "คน" → ผู้ใช้ในสาขาเดียวกันทับกันเอง
// เขียนได้เฉพาะโปรไฟล์ตัวเอง · บทบาท/สาขา แก้เองไม่ได้ (trigger ที่ DB กัน)
export interface ProfileRepo {
  get(): Promise<UserProfile | null>;
  save(p: UserProfile): Promise<void>;
}

// ── ข้อมูลบริษัทของสำนักงานใหญ่ — อ่านได้ทุกคน เขียนเฉพาะผู้มีสิทธิ์แก้ข้อมูลกลาง ──
export interface HQCompanyRepo {
  get(): Promise<HQCompany>;
  save(c: HQCompany): Promise<void>;
}

// ── โน้ตลูกค้า (ของแต่ละสาขา) ──
export interface NotesRepo {
  list(scope?: Scope): Promise<CustomerNote[]>;
  create(n: Omit<CustomerNote, "id">): Promise<CustomerNote>;
  update(n: CustomerNote): Promise<CustomerNote>;
  remove(id: number): Promise<void>;
}

// ── ผู้ใช้ในระบบ (หน้า /hq/users) ──
// อ่านได้ = HQ · แก้บทบาท/สถานะ/แผนก ได้เฉพาะ SUPER_ADMIN (บังคับที่ RLS)
//
// ⚠️ สร้าง/ลบบัญชีจริงทำจากฝั่ง client ไม่ได้ — ต้องใช้ service_role ซึ่งห้ามอยู่ในเบราว์เซอร์
//    (แอปจึงต้องปิดปุ่มพวกนั้นในโหมดจริง ไม่ใช่ปล่อยให้กดแล้วเข้าใจว่าสำเร็จ)
export interface UsersRepo {
  list(): Promise<SystemUser[]>;
  /** แก้ได้เฉพาะ บทบาท/สถานะ/แผนก/ชื่อ — อีเมลล็อกอินอยู่ที่ระบบยืนยันตัวตน */
  update(u: Pick<SystemUser, "id" | "name" | "role" | "department" | "status">): Promise<void>;
  /** สร้าง/ลบบัญชีได้ไหมในโหมดนี้ — โหมดเดโมได้ · โหมดจริงต้องทำที่ระบบยืนยันตัวตน */
  canCreate(): boolean;
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
  /** เลขที่ใบต่อสาขาแบบ atomic (supabase=RPC · local=max+1)
   *  prefix = คำนำหน้าที่ "ตัวแทน" ตั้งเอง (ตั้งค่า › ใบเสนอราคา) — ผู้เรียกส่งมาให้ ไม่ใช่ adapter ไปอ่านเอง */
  nextQuoteNo(dealer: string, prefix?: string): Promise<string>;
  /** ปิดใบที่ "ส่งแล้ว" และเลยวันหมดอายุ → สถานะ expired · asOf = วันนี้ของระบบ (YYYY-MM-DD) · คืนจำนวนใบที่ปิด */
  expireOverdue(asOf: string, scope?: Scope): Promise<number>;
}
export interface CustomersRepo {
  list(scope?: Scope): Promise<CustomerRow[]>;
  // เลข id ถัดไปของสาขา — supabase: RPC atomic (กันชนเมื่อสร้างพร้อมกัน) · local: max+1
  nextId(dealerCode: string): Promise<number>;
  create(row: CustomerRow): Promise<CustomerRow>;
  update(row: CustomerRow): Promise<CustomerRow>;
  remove(id: number): Promise<void>;
}
export interface AppointmentsRepo {
  list(scope?: Scope): Promise<AppointmentMock[]>;
  nextId(dealerCode: string): Promise<number>;
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

// การเปลี่ยนแปลงราย "แถว" — พก record มาด้วย เพื่อให้หน้าจอ patch เฉพาะแถวนั้น
// (เดิมส่งแค่ชื่อตาราง → ต้องโหลดทั้งตารางใหม่ทุก event ซึ่งไม่ไหวเมื่อข้อมูลเยอะ · H2)
// แถวที่ส่งมาถูก RLS กรองแล้ว = เห็นเฉพาะที่มีสิทธิ์เห็น
export type SalesChange =
  | { table: "leads";        type: "INSERT" | "UPDATE"; row: LeadRow }
  | { table: "quotations";   type: "INSERT" | "UPDATE"; row: QuotationMock }
  | { table: "customers";    type: "INSERT" | "UPDATE"; row: CustomerRow }
  | { table: "appointments"; type: "INSERT" | "UPDATE"; row: AppointmentMock }
  | { table: SalesTable;     type: "DELETE"; id: string | number };

export interface RealtimePort {
  /** เรียก onChange ทุกครั้งที่มีแถวเปลี่ยน (RLS กรองให้แล้ว) · คืนฟังก์ชัน unsubscribe */
  subscribeSales(onChange: (change: SalesChange) => void): () => void;
  /** แคตตาล็อกแม่แบบ/ราคากลางเปลี่ยน (HQ แก้ที่ /hq/master) → ทุกหน้าที่ใช้ catalog อัปเดตตาม */
  subscribeCatalog(onChange: () => void): () => void;
  /** นโยบาย/เป้า/กฎแจ้งเตือนของ HQ เปลี่ยน → ฝั่งตัวแทนใช้ค่าใหม่ทันที (VAT/อายุใบมีผลกับการคิดเงิน) */
  subscribeSettings(onChange: () => void): () => void;
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
  dealerSettings: DealerSettingsRepo;
  profile: ProfileRepo;
  hqCompany: HQCompanyRepo;
  notes: NotesRepo;
  users: UsersRepo;
  audit: AuditRepo;
  leads: LeadsRepo;
  quotations: QuotationsRepo;
  customers: CustomersRepo;
  appointments: AppointmentsRepo;
}
