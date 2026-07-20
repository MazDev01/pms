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
  list(): Promise<DealerFile[]>;
  add(f: Omit<DealerFile, "id">): Promise<DealerFile>;
  remove(id: number): Promise<void>;
}
export interface PersonsRepo {
  list(): Promise<ResponsiblePerson[]>;
  save(all: ResponsiblePerson[]): Promise<void>;
}
export interface SettingsRepo {
  getPolicy(): Promise<HQPolicy>;
  getTargets(): Promise<HQTargets>;
  getNotifRules(): Promise<HQNotifRules>;
  getLeadRulesMap(): Promise<DealerLeadRulesMap>;
  saveLeadRules(dealerCode: string, rules: LeadRules): Promise<void>;
  getQuoteValidityDays(): Promise<number>;
}
export interface AuditRepo {
  list(): Promise<AuditEntry[]>;
  append(e: Omit<AuditEntry, "id" | "at">): Promise<void>;
}

// ── โดเมนงานขาย — Step 0 มี list (อ่าน) · CRUD เต็มต่อผ่าน SalesContext ใน Step 1 ──
export interface LeadsRepo { list(scope?: Scope): Promise<LeadRow[]>; }
export interface QuotationsRepo { list(scope?: Scope): Promise<QuotationMock[]>; }
export interface CustomersRepo { list(scope?: Scope): Promise<CustomerRow[]>; }
export interface AppointmentsRepo { list(scope?: Scope): Promise<AppointmentMock[]>; }

// ── รวมทุก repository เป็น adapter เดียว ──
export interface DataAdapter {
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
