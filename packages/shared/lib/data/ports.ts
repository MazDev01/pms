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
export interface QuoteProductRow { product: string | null; value: number; projects: number; }
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
/** อาคารที่ลูกค้าซื้อ (ใบ won) — ดิบจาก DB · client คิด mainTemplate/วันส่งมอบต่อ (M9 Phase 2) */
export interface WonBuildingRaw { quoteNo: string; productLine: string; valueNum: number; date: string; }
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
  unassigned: { numId: number; company: string; province: string; value: string }[];
  idle: { numId: number; company: string; assigned: string; idleDays: number }[];
  expiring: { quoteNo: string; customer: string; value: number; dealerCode: string | null; daysLeft: number }[];
  dealerLatest: { dealerCode: string; idleDays: number }[];
  lostRate: { dealerCode: string; lost: number; closed: number }[];
}
export interface HQAlertsFilters {
  asOf?: string; unassignedDefaultHours?: number; unassignedPerDealer?: Record<string, number>;
  leadIdleDays?: number; quoteValidityDays?: number; quoteExpiringDays?: number; dealerIdleDays?: number;
}
export interface MetricsRepo {
  /** rollup รายสาขาของปีที่ระบุ (key = dealerCode) — supabase: RPC dealer_rollup · local: คำนวณจาก array เอง
   *  scope คุมด้วย RLS ฝั่ง supabase (ตัวแทน=สาขาตน · HQ=ทั้งเครือ) เหมือนที่ client เคยเห็น */
  dealerRollup(year: number, opts?: DealerRollupOpts): Promise<Map<string, DealerRollup>>;
  /** สรุปลีดหลังกรอง (byStatus/bySource/byProduct/byLostReason/byMonth) — ป้อน analytics หน้า /hq/leads */
  leadSummary(filters: LeadSummaryFilters): Promise<LeadSummary>;
  /** ใบ won จับกลุ่มตามลูกค้า (key = `${dealerCode}|${customer}`) — ป้อน useCustomerDb (M9 Phase 2) */
  customerRollup(): Promise<Map<string, WonBuildingRaw[]>>;
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
  /** เลขที่ใบต่อสาขาแบบ atomic (supabase=RPC · local=max+1)
   *  prefix = คำนำหน้าที่ "ตัวแทน" ตั้งเอง (ตั้งค่า › ใบเสนอราคา) — ผู้เรียกส่งมาให้ ไม่ใช่ adapter ไปอ่านเอง */
  nextQuoteNo(dealer: string, prefix?: string): Promise<string>;
  /** ออกเลขที่ใบ + insert ใน "ทรานแซกชันเดียว" (atomic) — insert ล้ม = เลขไม่หาย (H8)
   *  รับ row ที่ "ยังไม่มี id" (DB เป็นคนออกเลขให้) · คืนใบที่บันทึกจริงพร้อมเลขที่
   *  supabase: RPC create_quotation (ออกเลข+insert รวด) · local: max+1 แล้ว insert (เธรดเดียว = atomic) */
  createNumbered(dealer: string, prefix: string | undefined, row: Omit<QuotationMock, "id">): Promise<QuotationMock>;
  /** ปิดใบที่ "ส่งแล้ว" และเลยวันหมดอายุ → สถานะ expired · asOf = วันนี้ของระบบ (YYYY-MM-DD) · คืนจำนวนใบที่ปิด */
  // validityDays: อายุใบเสนอราคาเริ่มต้น (นโยบาย HQ) — ใช้เป็น "หมดอายุ" ของใบที่ไม่ได้กรอก expiry เอง
  //   (นิยามเดียวกับที่ hq_alerts ใช้เตือน "ใกล้หมดอายุ" — ไม่งั้นสองจุดเห็นวันหมดอายุคนละวัน)
  expireOverdue(asOf: string, scope?: Scope, validityDays?: number): Promise<number>;
  /** ผู้รับผิดชอบใบ (จากลีดที่ผูก) รายใบ — ป้อน drawer โดยไม่ต้องโหลดลีดทั้งเครือ (M9 Phase 4) · ไม่พบ = null */
  salesperson(quoteId: string): Promise<string | null>;
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
  /** นัดหมายของสาขาหนึ่ง (HQ เจาะดูตัวแทน) — ดึงเฉพาะที่ต้องใช้ ไม่ต้องโหลดทั้งเครือ (M9 Phase 4) */
  listForDealer(dealerCode: string): Promise<AppointmentMock[]>;
  /** นัดหมายของลีดหนึ่ง (drawer ดูลีด) — ผูกด้วย lead_id = numId (M9 Phase 4) */
  listForLead(leadId: number): Promise<AppointmentMock[]>;
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
