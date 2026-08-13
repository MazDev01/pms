// Ports — สัญญา (interface) ที่ทุก adapter ต้องมี
// context/hook เรียกผ่าน repository เหล่านี้เท่านั้น · เบื้องหลังสลับ adapter ได้
// ทุกเมธอดเป็น async ตั้งแต่แรก → ต่อ network (เฟส B) ไม่ต้องแก้ signature
import type {
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap, LeadTaskDef,
  AuditEntry, LeadRow, QuotationMock, CustomerRow, AppointmentMock, Scope,
  DealerSettings, UserProfile, HQCompany, CustomerNote, SystemUser,
} from "./types";

// ── โดเมนอ้างอิง/ตั้งค่า (ห่อ loader เดิมได้ทันที — Step 0) ──
export interface DealersRepo {
  list(): Promise<DealerRow[]>;
  /** เพิ่ม/แก้ (upsert) ตามชุดที่ส่งมา — "ไม่" ลบแถวที่ไม่ได้ส่งมา */
  save(all: DealerRow[]): Promise<void>;
  /** ลบสาขา — ต้องสั่งตรง ๆ ห้ามให้ระบบเดาจากการที่แถวหายไปจากอาร์เรย์ */
  remove(code: string): Promise<void>;
}
export interface CatalogRepo {
  list(): Promise<SolutionProduct[]>;
  /** เพิ่ม/แก้ (upsert) ตามชุดที่ส่งมา — "ไม่" ลบแถวที่ไม่ได้ส่งมา */
  save(all: SolutionProduct[]): Promise<void>;
  /** ลบแม่แบบ — ต้องสั่งตรง ๆ (ดูเหตุผลที่ DealersRepo.remove) */
  remove(id: string): Promise<void>;
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
  /** งานมาตรฐานของแต่ละขั้นในเส้นทางการขาย ที่ HQ ตั้ง — ตัวแทนเช็กงานชุดนี้ (เขียนได้เฉพาะ HQ) */
  getLeadTasks(): Promise<LeadTaskDef[]>;
  saveLeadTasks(tasks: LeadTaskDef[]): Promise<void>;
  // เขียนนโยบายระดับเครือ (HQ เท่านั้น — RLS is_hq ฝั่ง supabase · singleton id=1)
  savePolicy(policy: HQPolicy): Promise<void>;
  saveTargets(targets: HQTargets): Promise<void>;
  saveNotifRules(rules: HQNotifRules): Promise<void>;
  /** กู้คืน/นำเข้าค่าตั้งหลายกลุ่มพร้อมกันแบบ all-or-nothing (Phase 4 transaction, 0093) — undefined = ไม่แตะ
   *  กลุ่มนั้น · ใช้กับปุ่ม "นำเข้า (กู้คืน)"/"คืนค่าเริ่มต้น" หน้า HQ ตั้งค่า (เดิมยิงแยกทีละกลุ่ม เน็ตหลุด
   *  กลางทาง = กู้คืนได้แค่บางส่วน) · supabase: RPC restore_hq_settings · local: เขียนทีละกลุ่มในเครื่อง */
  restoreSettings(patch: {
    policy?: HQPolicy; targets?: HQTargets; notifRules?: HQNotifRules; lostReasons?: string[]; company?: HQCompany;
  }): Promise<void>;
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
  /** แก้ได้: ชื่อ/บทบาท/แผนก/สถานะ/รูป/เบอร์/อีเมลติดต่อ
   *
   *  ⚠️ "email" ที่นี่คือ **อีเมลติดต่อ** ที่ผู้ใช้ตั้งเอง ไม่ใช่อีเมลที่ใช้ล็อกอิน
   *     อีเมลล็อกอินอยู่ที่ระบบยืนยันตัวตน แก้จากหน้านี้ไม่ได้
   *
   *  รูป/เบอร์/อีเมลติดต่อ เคยไม่อยู่ในรายการนี้ (แก้ 11 ส.ค. 69) ทั้งที่ฟอร์มแก้ไขผู้ใช้
   *  ให้กรอกได้ครบ ผลคือเปลี่ยนรูปแล้วหน้าจอขึ้นรูปใหม่ให้ดู แต่ไม่เคยถูกบันทึกเลย
   *  พอโหลดหน้าใหม่รูปเก่ากลับมา — ผู้ใช้แจ้งว่า "เปลี่ยนรูปแล้วทำไมไม่เปลี่ยน"
   */
  update(u: Pick<SystemUser, "id" | "name" | "role" | "department" | "status">
    & Partial<Pick<SystemUser, "avatar" | "phone" | "email">>): Promise<void>;
  /** สร้าง/ลบบัญชีได้ไหมในโหมดนี้ — โหมดเดโมได้ · โหมดจริงต้องทำที่ระบบยืนยันตัวตน */
  canCreate(): boolean;
}

export interface AuditRepo {
  /** อ่านบันทึกล่าสุดสูงสุด `limit` รายการ (ใหม่→เก่า) — audit_log โตไม่จำกัด จึงมีเพดานอ่านเสมอ (M8)
   *  ไม่ส่ง limit = ใช้ค่า default ของ adapter · หน้า /hq/audit แจ้งเมื่อชนเพดาน (ไม่ตัดเงียบ) */
  list(limit?: number): Promise<AuditEntry[]>;
  append(e: Omit<AuditEntry, "id" | "at">): Promise<void>;
}

// ── ตัวชี้วัดที่รวมยอดที่ DB (M9 Phase 1) — client ไม่ต้องดึงทุกแถวมารวมเอง ──
/** rollup ผลงานรายสาขา — นิยามตรงกับ useDealerPerformance (parity บังคับ) */
export interface DealerRollup {
  quotes: number;
  won: number;
  lost: number;
  /** Σ มูลค่าใบ won ที่ปีของ date = ปีที่ขอ */
  revenue: number;
  /** ลีดที่ยังไม่ปิด (status ไม่ใช่ PAID/CANCELLED) */
  openLeads: number;
  /** ลีดเปิดที่เงียบเกินเกณฑ์ (needsFollowUp) — ใช้คิด onTimePct = (open−stale)/open */
  staleLeads: number;
}
/** พารามิเตอร์คิด stale (onTimePct) — as_of + เกณฑ์วันรายสาขา (rules[code] ?? default) */
export interface DealerRollupOpts { asOf: string; defaultDays: number; perDealer: Record<string, number>; }
/** สถิติใบเสนอราคารายสาขา "ในช่วงวันที่" — ป้อน Scorecard (ผลรวม) + dealerStats ของ /hq/dashboard */
export interface QuoteRangeRow {
  quotes: number;
  won: number;
  lost: number;
  /** Σ total_value ของใบ won ในช่วง */
  wonVal: number;
  /** Σ total_value ของทุกใบในช่วง */
  quoteVal: number;
}
/** สรุปใบเสนอราคาของ /hq/dashboard ในช่วง — 3 ชุด ป้อนได้หลายการ์ดในรอบเดียว */
export interface QuoteMonthRow { y: number; m: number; quotes: number; won: number; lost: number; wonVal: number; }
export interface QuoteStatusRow { status: string; count: number; value: number; }
// wonValue/wonProjects = เฉพาะใบที่ปิดการขายได้ — การ์ด "ยอดขาย" ต้องใช้ตัวนี้เท่านั้น
// (value/projects = ทุกใบรวมร่าง ใช้กับการ์ดที่พูดถึง "ใบเสนอราคา" ไม่ใช่ "ยอดขาย")
export interface QuoteProductRow { product: string | null; value: number; projects: number; wonValue?: number; wonProjects?: number; }
export interface DashboardQuoteSummary {
  byMonth: QuoteMonthRow[];
  byStatus: QuoteStatusRow[];
  byProduct: QuoteProductRow[];
}
/** สรุปใบเสนอราคา "หลังกรอง" สำหรับ /hq/quotations (M9 Phase 2) — ป้อน analytics ทั้งหน้า */
export interface QuoteDealerRow { dealerCode: string; count: number; value: number; sent: number; won: number; lost: number; wonVal: number; latest?: string | null; }
export interface QuoteAgingRow { bucket: string; count: number; value: number; }
export interface HQQuotationsSummary {
  byDealer: QuoteDealerRow[];
  byMonth: QuoteMonthRow[];
  byProduct: QuoteProductRow[];
  aging: QuoteAgingRow[];
}
/** ชุดกรองของหน้า quotations — derived filter (region/province/ชื่อ→dealerCodes · product→productLines) resolve มาก่อน */
export interface QuoteSummaryFilters {
  status?: string;
  dealerCodes?: string[];
  productLines?: string[];
  search?: string;
  /** รหัสตัวแทนที่ชื่อ/รหัส match คำค้น — OR เข้ากับ id/customer (ให้ search ตรงกับ client ที่ค้นชื่อตัวแทนได้) */
  searchDealers?: string[];
  dateStart?: string;
  dateEnd?: string;
  asOf?: string; // "วันนี้ของระบบ" (APP_NOW ISO) สำหรับคิดอายุใบ
}
/** สรุปลีด "หลังกรอง" สำหรับ /hq/leads (M9 Phase 2) */
export interface LeadMonthRow { y: number; m: number; created: number; won: number; lost: number; }
export interface LeadSummary {
  byStatus: { status: string; count: number; value: number }[];
  bySource: { source: string; count: number }[];
  byProduct: { product: string; count: number }[];
  byLostReason: { reason: string; count: number; value: number }[];
  /** จังหวัด (ลูกค้า) ที่มีลีด — ป้อนตัวเลือกดรอปดาวน์ "จังหวัด" หน้า /hq/leads (M9 Phase 4) */
  byProvince: { province: string; count: number }[];
  byMonth: LeadMonthRow[];
  /** รายสาขา — leads=จำนวนลีด · quoted=ถึงขั้นเสนอราคาขึ้นไป (QUOTED_UP) · ป้อน leadVsQuote/dealerPerf */
  byDealer: { dealerCode: string; leads: number; quoted: number }[];
}
export interface LeadSummaryFilters {
  dealerCodes?: string[]; province?: string; product?: string; source?: string;
  search?: string; status?: string; dateStart?: string; dateEnd?: string;
}
/** สรุปลูกค้าทั้งเครือ — total (จำนวนลูกค้า) + ยอดขายรายจังหวัด · ป้อน KPI ลูกค้า + provinceTop6 (M9 Phase 4) */
export interface NetworkCustomerSummary {
  total: number;
  byProvince: { province: string; revenue: number; count: number }[];
}
/** ลีดไร้ผู้รับผิดชอบเกินเกณฑ์ (ชม.) รายสาขา — ป้อนการ์ดเตือน /hq/leads (M9 Phase 4) */
export interface UnassignedSummary {
  total: number;
  byDealer: { dealerCode: string; count: number }[];
}
export interface UnassignedFilters {
  asOf?: string; defaultHours?: number; perDealer?: Record<string, number>;
  dealerCodes?: string[]; province?: string; product?: string; source?: string;
  search?: string; dateStart?: string; dateEnd?: string;
}
/** ผู้สมัครของกฎแจ้งเตือน HQ (คำนวณที่ DB) — client ประกอบเป็นข้อความ + toggle (M9 Phase 4) */
export interface HQAlertsData {
  unassigned: { numId: number; dealerCode: string | null; company: string; province: string; value: string }[];
  idle: { numId: number; dealerCode: string | null; company: string; assigned: string; idleDays: number }[];
  expiring: { quoteNo: string; customer: string; value: number; dealerCode: string | null; daysLeft: number }[];
  dealerLatest: { dealerCode: string; idleDays: number }[];
  lostRate: { dealerCode: string; lost: number; closed: number }[];
}
export interface HQAlertsFilters {
  asOf?: string; unassignedDefaultHours?: number; unassignedPerDealer?: Record<string, number>;
  leadIdleDays?: number; quoteValidityDays?: number; quoteExpiringDays?: number; dealerIdleDays?: number;
}
// ── หน้าฐานข้อมูลลูกค้า HQ (M9 Phase 6) — filter+pagination+KPI/กราฟ ที่ DB (ดู migration 0080) ──
export interface HQCustomerPageRow {
  id: number; name: string; dealerCode: string; dealerName: string; province: string;
  totalValue: number; buildingTypes: string[]; templates: string[];
  /** ISO date (ไม่ใช่ Thai string) — client format เองด้วย toThaiDate/fmtISOToThai ตอนแสดงผล */
  deliveredAt: string | null; lastPurchaseAt: string | null;
}
export interface HQCustomersPageOpts {
  search?: string; dealerCode?: string; provinces?: string[]; buildingType?: string; deliveryYear?: number;
  limit: number; offset: number;
}
export interface HQCustomersKPI { total: number; active: number; revenue: number; repeat: number; }
export interface HQCustomersCharts {
  byType: { label: string; value: number }[];
  bySubtype: { label: string; value: number }[];
  byProvince: { label: string; value: number }[];
  byDealer: { code: string; name: string; value: number }[];
  revenueByDealer: { code: string; revenue: number }[];
}
/** kpi/charts คำนวณจาก "ทั้งชุดที่กรองแล้ว" เสมอ (ไม่ใช่แค่ rows ของหน้าปัจจุบัน) — ตรงกับพฤติกรรมเดิมของหน้า */
export interface HQCustomersPageResult {
  total: number; kpi: HQCustomersKPI; charts: HQCustomersCharts; rows: HQCustomerPageRow[];
}
export interface HQCustomersFilterOptions {
  dealers: { code: string; name: string }[];
  provinces: string[];
  types: string[];
  years: number[];
}
export interface MetricsRepo {
  /** rollup รายสาขาของปีที่ระบุ (key = dealerCode) — supabase: RPC dealer_rollup · local: คำนวณจาก array เอง
   *  scope คุมด้วย RLS ฝั่ง supabase (ตัวแทน=สาขาตน · HQ=ทั้งเครือ) เหมือนที่ client เคยเห็น */
  dealerRollup(year: number, opts?: DealerRollupOpts): Promise<Map<string, DealerRollup>>;
  /** สรุปลีดหลังกรอง (byStatus/bySource/byProduct/byLostReason/byMonth) — ป้อน analytics หน้า /hq/leads */
  leadSummary(filters: LeadSummaryFilters): Promise<LeadSummary>;
  /** สรุปใบหลังกรอง (byDealer/byMonth/byProduct/aging) — ป้อน analytics หน้า /hq/quotations (M9 Phase 2) */
  hqQuotationsSummary(filters: QuoteSummaryFilters): Promise<HQQuotationsSummary>;
  /** สถิติใบในช่วง [start,end] (ISO YYYY-MM-DD, inclusive) รายสาขา (key = dealerCode)
   *  dealer ระบุ = ดูตัวแทนรายตัว (selDealer) · ไม่ระบุ = ทั้ง scope · parity กับ winQuotes ฝั่ง client */
  networkQuoteRange(start: string, end: string, dealer?: string): Promise<Map<string, QuoteRangeRow>>;
  /** สรุปใบในช่วง (byMonth/byStatus/byProduct) รอบเดียว — ป้อนการ์ด dashboard หลายใบ (M9) */
  dashboardQuoteSummary(start: string, end: string, dealer?: string): Promise<DashboardQuoteSummary>;
  /** สรุปลูกค้าทั้งเครือ (total + byProvince) — ปลด dashboard ออกจาก netCustomers array (M9 Phase 4) */
  networkCustomerSummary(): Promise<NetworkCustomerSummary>;
  /** ลีดไร้ผู้รับผิดชอบเกินเกณฑ์ (ชม.) รายสาขา — ปลดการ์ดเตือน /hq/leads ออกจาก netLeads array (M9 Phase 4) */
  unassignedLeads(filters: UnassignedFilters): Promise<UnassignedSummary>;
  /** ผู้สมัครกฎแจ้งเตือน HQ (unassigned/idle/expiring/dealerLatest/lostRate) — ปลดกระดิ่ง HQ ออกจาก array (M9 Phase 4) */
  hqAlerts(filters: HQAlertsFilters): Promise<HQAlertsData>;
  /** หน้าเดียวของฐานข้อมูลลูกค้า HQ + KPI/กราฟ 5 ตัวจากทั้งชุดที่กรองแล้ว — ปลด /hq/customers จากการดึงทั้งตาราง (M9 Phase 6) */
  hqCustomersPage(opts: HQCustomersPageOpts): Promise<HQCustomersPageResult>;
  /** ตัวเลือกตัวกรอง (ตัวแทน/จังหวัด/ประเภทอาคาร/ปีที่ส่งมอบ) ของหน้าฐานข้อมูลลูกค้า — ไม่อิงตัวกรองปัจจุบัน */
  hqCustomersFilterOptions(): Promise<HQCustomersFilterOptions>;
}

// ── โดเมนงานขาย — list (อ่าน) + CRUD เต็ม (Phase 0) ──
// write ทุกตัว implement ทั้ง LocalAdapter (localStorage) และ SupabaseAdapter (insert/update/delete)
// ฝั่ง Supabase: dealer_code ต้องตรงสาขา session (บังคับด้วย RLS with-check ที่ DB)
/** ตัวเลือกดึงลีดแบบ "แบ่งหน้า + กรอง ที่ DB" (M9 Phase 4) — ผู้เรียก resolve region→dealerCodes มาก่อน
 *  overdue (needsFollowUp) กรองที่ DB ด้วย last_contact_at + เกณฑ์รายสาขา (asOf/defaultDays/perDealer) */
export interface LeadListOpts {
  limit: number;
  offset: number;
  status?: string;
  dealerCodes?: string[];
  province?: string;
  product?: string;
  source?: string;             // "ไม่ระบุ" = source ว่าง
  search?: string;             // ilike company/contact/province/product/assigned/id/dealer_code
  dateStart?: string;
  dateEnd?: string;
  overdue?: boolean;           // เฉพาะลีดเปิดที่เงียบเกินเกณฑ์
  asOf?: string; defaultDays?: number; perDealer?: Record<string, number>;
}
export interface LeadListResult { rows: LeadRow[]; total: number; }
export interface LeadsRepo {
  list(scope?: Scope): Promise<LeadRow[]>;
  /** หน้าเดียวของลีด + จำนวนรวมหลังกรอง (M9 Phase 4) — supabase: query ที่ DB · local: filter/sort/slice */
  listPage(scope: Scope | undefined, opts: LeadListOpts): Promise<LeadListResult>;
  /** เลข num_id ถัดไปของสาขาแบบ atomic (M7) — supabase: RPC next_entity_id · local: max+1
   *  id ที่แสดง (#L-....) แอป derive จาก num_id นี้ · เดิม Math.max+1 ฝั่ง client ชนกันได้ */
  nextNumId(dealerCode: string): Promise<number>;
  create(row: LeadRow): Promise<LeadRow>;
  update(row: LeadRow): Promise<LeadRow>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: LeadRow["status"]): Promise<void>;
}
/** ตัวเลือกดึงใบแบบ "แบ่งหน้า + กรอง + เรียง ที่ DB" (M9 Phase 2) — ผู้เรียก resolve derived filter มาก่อน
 *  (region/province/ชื่อตัวแทน → dealerCodes · product → productLines) เหลือแต่คอลัมน์จริงส่งให้ DB */
export interface QuoteListOpts {
  limit: number;
  offset: number;
  sort?: { col: "date" | "total_value" | "status" | "id"; dir: "asc" | "desc" };
  status?: string;              // สถานะเดียว (เว้น = ทุกสถานะ)
  dealerCodes?: string[];       // dealer_code in (...) — จาก dealer/region/province/ค้นหาชื่อ
  productLines?: string[];      // product_line in (...) — จาก product filter (รวม mainTemplate ที่ resolve แล้ว)
  search?: string;              // ilike บน id/customer
  searchDealers?: string[];     // รหัสตัวแทนที่ชื่อ/รหัส match คำค้น — OR เข้ากับ search (ค้นชื่อตัวแทน)
  dateStart?: string;           // ISO YYYY-MM-DD (inclusive) บนคอลัมน์ date
  dateEnd?: string;
}
export interface QuoteListResult { rows: QuotationMock[]; total: number; }
export interface QuotationsRepo {
  list(scope?: Scope): Promise<QuotationMock[]>;
  /** หน้าเดียวของใบ + จำนวนรวมหลังกรอง (M9 Phase 2) — supabase: query ที่ DB · local: filter/sort/slice array */
  listPage(scope: Scope | undefined, opts: QuoteListOpts): Promise<QuoteListResult>;
  create(row: QuotationMock): Promise<QuotationMock>;
  update(row: QuotationMock): Promise<QuotationMock>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: QuotationMock["status"]): Promise<void>;
  /** เปลี่ยนสถานะใบ + รวมยอดลูกค้าใหม่ (ถ้าใบผูก customer_id อยู่แล้ว) ในทรานแซกชันเดียว (0102) —
   *  เดิมเรียก setStatus แล้วค่อย customers.reconcileWonTotal แยกกัน 2 คำขอ ภายใต้โหลดสูงพบว่า
   *  reconcile บางครั้งคำนวณได้ 0 ทั้งที่สถานะเปลี่ยนไปแล้วจริง (ช่องว่างจังหวะเวลาระหว่าง 2 คำขอ
   *  ไม่ใช่เน็ตสะดุดที่ withNetworkRetry จับได้) — รวมเป็นคำสั่งเดียวตัดช่องว่างนั้นทิ้ง
   *  ใช้แทน setStatus เฉพาะกรณีที่ status เดิม/ใหม่เกี่ยวข้องกับ "won" (ต้อง reconcile) */
  setStatusReconciled(id: string, status: QuotationMock["status"]): Promise<{ quotation: QuotationMock; customer: CustomerRow | null }>;
  /** ออกเลขที่ใบ + insert ใน "ทรานแซกชันเดียว" (atomic) — insert ล้ม = เลขไม่หาย (H8)
   *  รับ row ที่ "ยังไม่มี id" (DB เป็นคนออกเลขให้) · คืนใบที่บันทึกจริงพร้อมเลขที่
   *  supabase: RPC create_quotation (ออกเลข+insert รวด) · local: max+1 แล้ว insert (เธรดเดียว = atomic) */
  createNumbered(dealer: string, prefix: string | undefined, row: Omit<QuotationMock, "id">): Promise<QuotationMock>;
  /** ปิดใบที่ "ส่งแล้ว" และเลยวันหมดอายุ → สถานะ expired · asOf = วันนี้ของระบบ (YYYY-MM-DD) · คืนจำนวนใบที่ปิด */
  // validityDays: อายุใบเสนอราคาเริ่มต้น (นโยบาย HQ) — ใช้เป็น "หมดอายุ" ของใบที่ไม่ได้กรอก expiry เอง
  //   (นิยามเดียวกับที่ hq_alerts ใช้เตือน "ใกล้หมดอายุ" — ไม่งั้นสองจุดเห็นวันหมดอายุคนละวัน)
  expireOverdue(asOf: string, scope?: Scope, validityDays?: number): Promise<number>;
  /** ผู้รับผิดชอบใบ (จากลีดที่ผูก) รายใบ — ป้อน drawer โดยไม่ต้องโหลดลีดทั้งเครือ (M9 Phase 4) · ไม่พบ = null */
  salesperson(quoteId: string, dealerCode: string): Promise<string | null>;
  /** ใบที่ won ของลูกค้ารายเดียว (ผูกด้วย customer_id) — ป้อนแท็บอาคาร/ประวัติ/ส่งมอบ/ไทม์ไลน์ของ
   *  CustomerDrawer โดยไม่ต้องโหลดใบทั้งเครือ (M9 Phase 6) — เหมือน appointments.listForLead */
  listForCustomer(customerId: number, dealerCode: string): Promise<QuotationMock[]>;
  /** ผูกใบเสนอราคา "กำพร้า" (customer_id ว่าง, ชื่อลูกค้าตรงกัน) เข้ากับลูกค้าที่เพิ่งสร้าง/พบ ทั้งชุด
   *  ในคำสั่งเดียว (atomic) — cascadeWon=true จะเลื่อนสถานะใบที่ยังไม่ปิด (ไม่ใช่ lost/expired) เป็น won
   *  ด้วย (ปิดจากฝั่งลีดโดยตรง) · supabase: RPC relink_customer_quotes (Phase 4, กัน partial-relink
   *  ที่เดิมเป็น N คำขอ update แยกกัน) · local: วนอัปเดตในเครื่อง (เธรดเดียว = atomic โดยธรรมชาติ) */
  relinkCustomerQuotes(dealer: string, customerId: number, company: string, cascadeWon: boolean): Promise<QuotationMock[]>;
}
// ตัวเลือกดึงลูกค้าแบบ "แบ่งหน้า + กรอง ที่ DB" (M9 Phase 5) — เจาะจุดที่ดึงทั้งตารางแล้ว filter ฝั่ง client
// (dealer-detail drawer, useHQSearch) ยังไม่ครอบคลุมหน้า /hq/customers หลัก ซึ่งต้องใช้ทั้งชุดเพื่อทำ KPI/analytics/filter
export interface CustomerListOpts {
  limit: number;
  offset: number;
  dealerCodes?: string[];
  search?: string;              // ilike name/company/province/phone
}
export interface CustomerListResult { rows: CustomerRow[]; total: number; }
export interface CustomersRepo {
  list(scope?: Scope): Promise<CustomerRow[]>;
  /** หน้าเดียวของลูกค้า + จำนวนรวมหลังกรอง — supabase: query ที่ DB · local: filter/slice */
  listPage(scope: Scope | undefined, opts: CustomerListOpts): Promise<CustomerListResult>;
  // เลข id ถัดไปของสาขา — supabase: RPC atomic (กันชนเมื่อสร้างพร้อมกัน) · local: max+1
  nextId(dealerCode: string): Promise<number>;
  create(row: CustomerRow): Promise<CustomerRow>;
  update(row: CustomerRow): Promise<CustomerRow>;
  remove(id: number): Promise<void>;
  // หา "ลูกค้าเดิมที่ชื่อบริษัทตรงเป๊ะ" หรือสร้างใหม่ — ทรานแซกชันเดียวที่ DB (supabase) กันแข่งกัน
  // ปิดลีดชื่อเดียวกันพร้อมกัน 2 session สร้างลูกค้าซ้ำ · local: เช็ก+สร้างในเครื่อง (เครื่องเดียว ไม่มี race จริง)
  upsertForCompany(dealerCode: string, row: CustomerRow): Promise<CustomerRow>;
  // รวมยอดลูกค้าใหม่จากใบ won ปัจจุบันตรงจาก DB (ไม่รับผลรวมจาก client) — กัน race ตอนแก้ 2 ใบพร้อมกัน (0078)
  // supabase: subquery SUM ในสเตตเมนต์ UPDATE เดียว ที่ DB · local: คำนวณจากอาร์เรย์ในเครื่อง (ไม่มี race จริง)
  reconcileWonTotal(customerId: number): Promise<CustomerRow>;
  /** ปิดการขายสำเร็จแบบ atomic ทั้งก้อน (Phase 4, 0094) — หา/สร้างลูกค้า + relink ใบกำพร้าของบริษัทนี้
   *  (cascade เป็น won ด้วยถ้า cascadeWon) + บังคับใบเป้าหมายเป็น won (ถ้าระบุ targetQuoteId) + รวมยอดใหม่
   *  ในทรานแซกชันเดียว — แทนที่ upsertForCompany + relink แยก + setStatus แยก + reconcile แยก (4 คำสั่งเขียน
   *  เดิม เน็ตหลุดกลางทางได้) · supabase: RPC close_won_quotation · local: เรียงลำดับ await เดิม (เธรดเดียว) */
  closeWon(args: {
    dealer: string; knownCustomerId: number | null; leadCompany: string;
    targetQuoteId: string | null; cascadeWon: boolean; customerPayload: CustomerRow;
  }): Promise<{ customer: CustomerRow; quotations: QuotationMock[] }>;
}
export interface AppointmentsRepo {
  list(scope?: Scope): Promise<AppointmentMock[]>;
  /** นัดหมายของสาขาหนึ่ง (HQ เจาะดูตัวแทน) — ดึงเฉพาะที่ต้องใช้ ไม่ต้องโหลดทั้งเครือ (M9 Phase 4) */
  listForDealer(dealerCode: string): Promise<AppointmentMock[]>;
  /** นัดหมายของลีดหนึ่ง (drawer ดูลีด) — ผูกด้วย lead_id = numId (M9 Phase 4) */
  listForLead(leadId: number, dealerCode: string): Promise<AppointmentMock[]>;
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
  /** โน้ตลูกค้าเปลี่ยน (เพิ่ม/แก้/ลบ จากอีกแท็บ/อีกเครื่อง) → โหลดโน้ตใหม่
   *  แยกช่องจาก subscribeSales เพราะโน้ตไม่ได้อยู่ในสี่ตารางงานขาย (0028 เปิด Realtime ให้แล้ว) */
  subscribeNotes(onChange: () => void): () => void;
  /** ตั้งค่าของสาขา (หัวกระดาษ/เอกสาร/โลโก้/แจ้งเตือน) เปลี่ยนจากอีกแท็บ/อีกเครื่อง → โหลดใหม่ (M4)
   *  0024 เปิด Realtime ให้ dealer_settings แล้ว · RLS กรองให้เห็นเฉพาะของสาขาตัวเอง */
  subscribeDealerSettings(onChange: () => void): () => void;
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
  metrics: MetricsRepo;
  leads: LeadsRepo;
  quotations: QuotationsRepo;
  customers: CustomersRepo;
  appointments: AppointmentsRepo;
}
