// Mock data สำหรับ frontend (ยังไม่เชื่อม backend)
// ─── ROLE / SESSION ───────────────────────────────────────────
export type UserRole =
  | "SUPER_ADMIN"
  | "HQ_MANAGEMENT"
  | "HQ_STAFF"
  | "DEALER_ADMIN"
  | "DEALER_SALES"
  | "DEALER_SITE";

export type MockSession = {
  name: string;
  role: UserRole;
  dealerName: string;
  dealerCode: string;  // "" = HQ (ไม่ผูกกับสาขา), "CNX" / "RYG" etc. = Dealer
  scopeAll: boolean;   // true = HQ เห็นทุก dealer
};

export const sessions: Record<string, MockSession> = {
  hq: {
    name: "วิชัย ประสิทธิ์",
    role: "HQ_MANAGEMENT",
    dealerName: "Benjamin HQ",
    dealerCode: "",
    scopeAll: true,
  },
  dealer: {
    name: "สมชาย เชียงใหม่",
    role: "DEALER_ADMIN",
    dealerName: "Benjamin สาขาเชียงใหม่",
    dealerCode: "CNX",
    scopeAll: false,
  },
};


// ─── RESPONSIBLE PERSONS ──────────────────────────────────────
export const RP_STORAGE_KEY = "bpms_responsible_persons";

export type ResponsiblePerson = {
  id: number;
  name: string;   // ชื่อเต็ม เช่น "สมชาย เชียงใหม่"
  title: string;  // ตำแหน่ง เช่น "ผู้จัดการฝ่ายขาย"
  phone: string;
  email: string;
  active: boolean;
};

export const responsiblePersons: ResponsiblePerson[] = [
  { id: 1, name: "สมชาย เชียงใหม่", title: "ผู้จัดการฝ่ายขาย", phone: "081-234-5678", email: "somchai@dealer.co.th", active: true },
  { id: 2, name: "วิภา รัตนกุล",    title: "เจ้าหน้าที่ขาย",   phone: "082-345-6789", email: "wipa@dealer.co.th",    active: true },
  { id: 3, name: "กาญจนา มีสุข",    title: "เจ้าหน้าที่ขาย",   phone: "083-456-7890", email: "kanjana@dealer.co.th", active: true },
  { id: 4, name: "วิชัย ประสิทธิ์", title: "ผู้ช่วยผู้จัดการ",  phone: "084-567-8901", email: "wichai@dealer.co.th",  active: true },
  { id: 5, name: "สุรชัย บุญมา",    title: "เจ้าหน้าที่ขาย",   phone: "085-678-9012", email: "surachai@dealer.co.th", active: false },
];

// โครงสร้างอ้างอิง prisma/schema.prisma

// Sales Journey — 8 ขั้นมาตรฐานเดียวทั้งระบบ (Lead → Contact → Requirement → Quotation → Follow-up → Negotiation → Won / Lost)
export type LeadStatus =
  | "NEW"        // Lead
  | "WAITING"    // Contact
  | "BULLET"     // Requirement
  | "QUOTED"     // Quotation
  | "FOLLOWUP"   // Follow-up
  | "NEGO"       // Negotiation
  | "PAID"       // Won
  | "CANCELLED"; // Lost

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW:       "ผู้สนใจใหม่",
  WAITING:   "ติดต่อแล้ว",
  BULLET:    "รวบรวมความต้องการ",
  QUOTED:    "เสนอราคา",
  FOLLOWUP:  "ติดตามผล",
  NEGO:      "เจรจาต่อรอง",
  PAID:      "ปิดการขาย (ได้งาน)",
  CANCELLED: "ไม่ได้งาน",
};

export const leadStatusColor: Record<LeadStatus, { bg: string; text: string }> = {
  NEW:       { bg: "#f0f0f5",  text: "#6b7280" },
  WAITING:   { bg: "#dce5f0",  text: "#003366" },
  BULLET:    { bg: "#dce5f0",  text: "#003366" },
  QUOTED:    { bg: "#dce5f0",  text: "#003366" },
  FOLLOWUP:  { bg: "#fff3cd",  text: "#d97706" },
  NEGO:      { bg: "#fde8cd",  text: "#b45309" },
  PAID:      { bg: "#e5faf0",  text: "#059669" },
  CANCELLED: { bg: "#fee2e2",  text: "#dc2626" },
};

// ─── Global: Tags (มาตรฐานเดียวทั้งระบบ) ───────────────────────────
export type TagKey = "VIP" | "HOT" | "Urgent" | "Government" | "Private";
export const TAGS: { key: TagKey; label: string; bg: string; color: string }[] = [
  { key: "VIP",        label: "VIP",    bg: "#fef3cd", color: "#b45309" },
  { key: "HOT",        label: "HOT",    bg: "#fee2e2", color: "#dc2626" },
  { key: "Urgent",     label: "ด่วน",   bg: "#fde8cd", color: "#c2410c" },
  { key: "Government", label: "ภาครัฐ", bg: "#e5faf0", color: "#065f46" },
  { key: "Private",    label: "เอกชน",  bg: "#dce5f0", color: "#003366" },
];
export const tagMeta = (t: string) => TAGS.find(x => x.key === t || x.label === t);

// ─── Global: Lost Reasons (เหตุผลที่เสียโอกาสการขาย) ────────────────
export const LOST_REASONS = ["ราคา", "คู่แข่ง", "งบประมาณ", "ลูกค้าเลื่อน", "ติดต่อไม่ได้", "อื่นๆ"] as const;
export type LostReason = typeof LOST_REASONS[number];

export const kpis = [
  { key: "target", label: "เป้า vs ยอดขาย", value: "68%", delta: 10.4, icon: "target" },
  { key: "pipeline", label: "มูลค่าโอกาสการขาย", value: "฿4.2M", delta: 8.6, icon: "trending" },
  { key: "win", label: "อัตราปิดการขาย", value: "35%", delta: 4.2, icon: "award" },
  { key: "projects", label: "โอกาสการขายที่กำลังดำเนินการ", value: "5", delta: 16.4, icon: "building" },
] as const;

// ยอดขาย/ลีด รายเดือน (กราฟเส้น)
export const salesByMonth = [
  { month: "ม.ค.", value: 820 },
  { month: "ก.พ.", value: 640 },
  { month: "มี.ค.", value: 980 },
  { month: "เม.ย.", value: 1200 },
  { month: "พ.ค.", value: 760 },
  { month: "มิ.ย.", value: 1080 },
  { month: "ก.ค.", value: 900 },
  { month: "ส.ค.", value: 1320 },
];

// สัดส่วน pipeline ตามสถานะ (โดนัท)
export const pipelineBreakdown = [
  { label: "เสนอราคา", value: 58, color: "var(--color-brand-blue)" },
  { label: "ต่อรอง", value: 24, color: "var(--color-silver)" },
  { label: "อื่นๆ", value: 18, color: "var(--color-steel)" },
];

export type LeadRow = {
  id: string;
  numId: number;
  name: string;
  company: string;
  contact: string;
  phone?: string;
  email?: string;
  province: string;
  product: string;
  category: string;
  status: LeadStatus;
  value: string;
  assigned: string;
  source?: string;
  note?: string;
  customerId?: number;
  logo?: string;   // รูป/โลโก้ลูกค้า (base64) — อัปโหลดในฟอร์มเพิ่มผู้สนใจ
};

export const leads: LeadRow[] = [
  { id: "#L-40322", numId: 1, name: "บจ. ไทยสตีล", company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", email: "somchai@thaisteel.co.th", province: "นนทบุรี", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "QUOTED", value: "฿1.2M", assigned: "สมชาย เชียงใหม่", source: "โทรเข้า", note: "ต้องการโกดัง 1,200 ตร.ม. พร้อมสำนักงาน", customerId: 1 },
  { id: "#L-40323", numId: 2, name: "บจ. ซีซีเอส", company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", email: "kanchana@ccs.co.th", province: "เชียงใหม่", product: "อาคารสำเร็จรูปทุกประเภท", category: "อาคารสำเร็จรูปทุกประเภท", status: "NEW", value: "฿480K", assigned: "วิภา รัตนกุล", source: "เว็บไซต์", customerId: 2 },
  { id: "#L-40324", numId: 3, name: "หจก. ราชบุรีโลหะ", company: "หจก. ราชบุรีโลหะ", contact: "คุณประยุทธ ร.", phone: "083-456-7890", email: "prayut@rajburimetal.com", province: "ราชบุรี", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "BULLET", value: "฿3.1M", assigned: "วิภา รัตนกุล", source: "แนะนำ", note: "ขอต่อรองราคาในใบเสนอราคา", customerId: 3 },
  { id: "#L-40325", numId: 4, name: "บจ. สมุทรโกดัง", company: "บจ. สมุทรโกดัง", contact: "คุณดารัล ส.", phone: "084-567-8901", email: "daran@samutwarehouse.co.th", province: "สมุทรปราการ", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "WAITING", value: "฿2.0M", assigned: "สมชาย เชียงใหม่", source: "งานแสดงสินค้า", customerId: 4 },
  { id: "#L-40326", numId: 5, name: "บจ. นครสวรรค์โลหะ", company: "บจ. นครสวรรค์โลหะ", contact: "คุณวิชัย น.", phone: "085-678-9012", email: "wichai@nsmetal.co.th", province: "นครสวรรค์", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "WAITING", value: "฿760K", assigned: "กาญจนา มีสุข", source: "Facebook", customerId: 8 },
  { id: "#L-40327", numId: 6, name: "บจ. ทีทีวาย", company: "บจ. ทีทีวาย อินเตอร์", contact: "คุณวิทยา ท.", phone: "086-789-0123", email: "wittaya@ttyinter.com", province: "นครสวรรค์", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "PAID", value: "฿5.4M", assigned: "สมชาย เชียงใหม่", source: "แนะนำ", note: "ปิดการขายแล้ว รอทำสัญญา" },
];

// ─── PROJECTS ─────────────────────────────────────────────────
export type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";

export type ProjectMock = {
  id: number; title: string; client: string; status: ProjectStatus;
  progress: number; start: string; due: string; assigned: string[]; value: string;
  customerId: number;    // link to customers[]
  quotationId?: string;  // link to quotations[]
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  not_started: "ยังไม่เริ่ม", in_progress: "กำลังดำเนินการ",
  on_hold: "หยุดชั่วคราว", completed: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
export const projectStatusColor: Record<ProjectStatus, { bg: string; text: string }> = {
  not_started: { bg: "#f0f0f5", text: "#6b7280" },
  in_progress:  { bg: "#dce5f0", text: "#003366" },
  on_hold:      { bg: "#fef3cd", text: "#f59e0b" },
  completed:    { bg: "#e5faf0", text: "#059669" },
  cancelled:    { bg: "#fee2e2", text: "#dc2626" },
};

export const projects: ProjectMock[] = [
  { id: 1, title: "โกดังสำเร็จรูป บจ. ไทยสตีล", client: "บจ. ไทยสตีล", status: "in_progress", progress: 65, start: "2026-04-01", due: "2026-07-31", assigned: ["สมชาย", "วิภา"], value: "฿1.8M", customerId: 1, quotationId: "Q-2026-0089" },
  { id: 2, title: "โรงงานสำเร็จรูป บจ. ซีซีเอส", client: "บจ. ซีซีเอส", status: "in_progress", progress: 28, start: "2026-05-15", due: "2026-08-15", assigned: ["วิชัย"], value: "฿3.2M", customerId: 2, quotationId: "Q-2026-0095" },
  { id: 3, title: "โกดังปากน้ำ พระปราชญ์", client: "คุณสมชาย", status: "not_started", progress: 0, start: "2026-07-01", due: "2026-10-31", assigned: [], value: "฿2.0M", customerId: 1, quotationId: "Q-2026-0097" },
  { id: 4, title: "โรงงานสำเร็จรูป นครสวรรค์", client: "บจ. นครสวรรค์โลหะ", status: "completed", progress: 100, start: "2026-01-01", due: "2026-03-31", assigned: ["สมชาย", "กาญจนา"], value: "฿5.4M", customerId: 8 },
  { id: 5, title: "โกดังสำเร็จรูป ราชบุรี", client: "หจก. ราชบุรีโลหะ", status: "on_hold", progress: 40, start: "2026-03-01", due: "2026-09-01", assigned: ["วิภา"], value: "฿760K", customerId: 3, quotationId: "Q-2026-0091" },
  { id: 6, title: "อาคารสำเร็จรูป แม่สอด", client: "บจ. แม่สอดโลหะ", status: "in_progress", progress: 82, start: "2026-02-01", due: "2026-06-30", assigned: ["สมชาย"], value: "฿4.1M", customerId: 6 },
  { id: 7, title: "อาคารสำเร็จรูป อุตรดิตถ์", client: "บจ. อุตรดิตถ์โลหะ", status: "not_started", progress: 0, start: "2026-08-01", due: "2026-12-31", assigned: [], value: "฿2.8M", customerId: 7, quotationId: "Q-2026-0098" },
  { id: 8, title: "โกดังระยอง VCS Asia", client: "VCS Asia", status: "completed", progress: 100, start: "2025-11-01", due: "2026-02-28", assigned: ["วิชัย", "กาญจนา"], value: "฿6.2M", customerId: 5, quotationId: "Q-2026-0092" },
];

// ─── TASKS ────────────────────────────────────────────────────
export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "cancelled";

export type TaskMock = {
  id: number; title: string; project: string | null; projectId: number | null;
  priority: TaskPriority; status: TaskStatus; statusTitle: string; statusColor: string;
  due: string | null; assigned: string[];
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "รอดำเนินการ", in_progress: "กำลังทำ",
  review: "กำลังรีวิว", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
export const taskStatusBadge: Record<TaskStatus, { bg: string; text: string }> = {
  todo:        { bg: "#f0f0f5", text: "#6b7280" },
  in_progress: { bg: "#dce5f0", text: "#003366" },
  review:      { bg: "#fef3cd", text: "#f59e0b" },
  done:        { bg: "#e5faf0", text: "#059669" },
  cancelled:   { bg: "#fee2e2", text: "#dc2626" },
};
export const taskPriorityColor: Record<TaskPriority, string> = {
  urgent: "#dc2626", high: "#f59e0b", normal: "#003366", low: "#6b7280",
};
export const taskPriorityLabel: Record<TaskPriority, string> = {
  urgent: "เร่งด่วน", high: "สูง", normal: "ปกติ", low: "ต่ำ",
};

export const tasks: TaskMock[] = [
  { id: 1,  title: "สำรวจความต้องการ บจ. ไทยสตีล",       project: "โกดังสำเร็จรูป บจ. ไทยสตีล", projectId: 1, priority: "urgent", status: "done",        statusTitle: "เสร็จแล้ว",      statusColor: "#059669", due: "2026-06-10", assigned: ["สมชาย"] },
  { id: 2,  title: "จัดทำใบเสนอราคา เฟส 1",       project: "โกดังสำเร็จรูป บจ. ไทยสตีล", projectId: 1, priority: "high",   status: "in_progress", statusTitle: "กำลังทำ",       statusColor: "#003366", due: "2026-06-30", assigned: ["วิภา", "สมชาย"] },
  { id: 3,  title: "นำเสนอใบเสนอราคา",         project: "โกดังสำเร็จรูป บจ. ไทยสตีล", projectId: 1, priority: "high",   status: "todo",        statusTitle: "รอดำเนินการ", statusColor: "#6b7280", due: "2026-07-05", assigned: [] },
  { id: 4,  title: "นำเสนอแบบโรงงานสำเร็จรูป",            project: "โรงงานสำเร็จรูป บจ. ซีซีเอส",        projectId: 2, priority: "urgent", status: "review",      statusTitle: "กำลังรีวิว",   statusColor: "#f59e0b", due: "2026-06-25", assigned: ["วิชัย"] },
  { id: 5,  title: "ตรวจสเปกโครงสร้างสำเร็จรูป",             project: "โรงงานสำเร็จรูป บจ. ซีซีเอส",        projectId: 2, priority: "normal", status: "todo",        statusTitle: "รอดำเนินการ", statusColor: "#6b7280", due: "2026-07-15", assigned: ["วิชัย"] },
  { id: 6,  title: "ปิดการขายโรงงานสำเร็จรูป",          project: "โรงงานสำเร็จรูป นครสวรรค์",   projectId: 4, priority: "normal", status: "done",        statusTitle: "เสร็จแล้ว",      statusColor: "#059669", due: "2026-03-31", assigned: ["สมชาย", "กาญจนา"] },
  { id: 7,  title: "โทรติดตามผู้สนใจ เฟส 3",       project: "โกดังสำเร็จรูป ราชบุรี",            projectId: 5, priority: "high",   status: "in_progress", statusTitle: "กำลังทำ",       statusColor: "#003366", due: "2026-07-01", assigned: ["วิภา"] },
  { id: 8,  title: "ประชุมลูกค้า แม่สอด",            project: "อาคารสำเร็จรูป แม่สอด",             projectId: 6, priority: "normal", status: "done",        statusTitle: "เสร็จแล้ว",      statusColor: "#059669", due: "2026-06-15", assigned: ["สมชาย"] },
  { id: 9,  title: "ติดตามใบเสนอราคาอาคารสำเร็จรูป",   project: "อาคารสำเร็จรูป แม่สอด",             projectId: 6, priority: "high",   status: "in_progress", statusTitle: "กำลังทำ",       statusColor: "#003366", due: "2026-06-28", assigned: ["สมชาย"] },
  { id: 10, title: "ปิดการขาย VCS Asia ระยอง",          project: "โกดังระยอง VCS Asia",          projectId: 8, priority: "normal", status: "done",        statusTitle: "เสร็จแล้ว",      statusColor: "#059669", due: "2026-02-28", assigned: ["วิชัย", "กาญจนา"] },
  { id: 11, title: "อัปเดตรายงานความคืบหน้าการขาย",        project: null,                            projectId: null, priority: "low", status: "todo",       statusTitle: "รอดำเนินการ", statusColor: "#6b7280", due: "2026-06-30", assigned: [] },
  { id: 12, title: "ประชุมทีมรายสัปดาห์",            project: null,                            projectId: null, priority: "normal", status: "in_progress", statusTitle: "กำลังทำ", statusColor: "#003366", due: "2026-06-22", assigned: ["สมชาย", "วิภา", "วิชัย"] },
  { id: 13, title: "ทบทวนเงื่อนไขใบเสนอราคา",                project: "โรงงานสำเร็จรูป บจ. ซีซีเอส",        projectId: 2, priority: "urgent", status: "cancelled",   statusTitle: "ยกเลิก",        statusColor: "#dc2626", due: "2026-06-18", assigned: [] },
  { id: 14, title: "สรุปผลงาน Q2 2026",              project: null,                            projectId: null, priority: "high", status: "todo",       statusTitle: "รอดำเนินการ", statusColor: "#6b7280", due: "2026-06-30", assigned: [] },
];

// ─── CUSTOMERS ────────────────────────────────────────────────
export type CustomerMock = {
  id: number; name: string; company: string; phone: string; email: string;
  province: string; category: string; initials: string; color: string;
  tags: string[]; projectCount: number;
};

export const customers: CustomerMock[] = [
  { id: 1, name: "คุณสมชาย ใจดี", company: "บจ. ไทยสตีล", phone: "081-234-5678", email: "somchai@thaisteel.co.th", province: "นนทบุรี", category: "EASYBUILD", initials: "สช", color: "#003366", tags: ["VIP", "สัญญาใหม่"], projectCount: 2 },
  { id: 2, name: "คุณกาญจนา ม.", company: "บจ. ซีซีเอส", phone: "082-345-6789", email: "kanjana@ccs.co.th", province: "เชียงใหม่", category: "PREFAB", initials: "กม", color: "#059669", tags: ["ต่อเนื่อง"], projectCount: 1 },
  { id: 3, name: "คุณประยุทธ ร.", company: "หจก. ราชบุรีโลหะ", phone: "083-456-7890", email: "prayuth@rajburi.co.th", province: "ราชบุรี", category: "RANBUILD", initials: "ปร", color: "#f59e0b", tags: ["โซนตะวันตก"], projectCount: 1 },
  { id: 4, name: "คุณดารัล ส.", company: "บจ. สมุทรโกดัง", phone: "084-567-8901", email: "darat@smgodown.co.th", province: "สมุทรปราการ", category: "EASYBUILD", initials: "ดส", color: "#002244", tags: ["ลูกค้าเดิม"], projectCount: 2 },
  { id: 5, name: "VCS Asia (ระยอง)", company: "VCS Asia Co., Ltd.", phone: "085-678-9012", email: "vcs@vcsasia.com", province: "ระยอง", category: "RANBUILD", initials: "VC", color: "#002244", tags: ["Enterprise", "Contract"], projectCount: 3 },
  { id: 6, name: "คุณสุรัตน์ ล.", company: "บจ. แม่สอดโลหะ", phone: "086-789-0123", email: "surat@maesot.co.th", province: "ตาก", category: "EASYBUILD", initials: "สล", color: "#C0C0C0", tags: ["โซนตะวันตก"], projectCount: 1 },
  { id: 7, name: "บจ. อุตรดิตถ์โลหะ", company: "บจ. อุตรดิตถ์โลหะ", phone: "087-890-1234", email: "info@uttaradit.co.th", province: "อุตรดิตถ์", category: "RANBUILD", initials: "อต", color: "#8fa3b8", tags: ["ลีดใหม่"], projectCount: 0 },
  { id: 8, name: "บจ. นครสวรรค์โลหะ", company: "บจ. นครสวรรค์โลหะ", phone: "088-901-2345", email: "nakhon@nsloha.co.th", province: "นครสวรรค์", category: "Custom", initials: "นส", color: "#059669", tags: ["ลูกค้าเดิม", "VIP"], projectCount: 2 },
];

// ─── CUSTOMER ROWS (rich, shared app-wide via SalesContext) ───
// แหล่งความจริงเดียวของ "ลูกค้า" ที่ใช้ทั้งหน้า ลูกค้า / ใบเสนอราคา / การแปลงจากลีด
export type CustomerStatus = "active" | "inactive";
export type CustomerType   = "บุคคล" | "บริษัท";
export type CustomerRow = {
  id:number; name:string; company:string; type:CustomerType; email:string; phone:string;
  province:string; category:string; status:CustomerStatus; projects:number;
  joinDate:string; owner:string; initials:string; color:string;
  totalValue:number;
};

export const initialCustomers: CustomerRow[] = [
  { id:1, name:"คุณสมชาย ใจดี",      company:"บจ. ไทยสตีล",          type:"บริษัท", email:"somchai@thaisteel.co.th",  phone:"081-234-5678", province:"นนทบุรี",       category:"โกดัง/คลังสินค้า",  status:"active",   projects:2, joinDate:"2025-09-15", owner:"สมชาย เชียงใหม่",  initials:"สช", color:"#003366", totalValue:1800000 },
  { id:2, name:"คุณกาญจนา ม.",        company:"บจ. ซีซีเอส",           type:"บริษัท", email:"kanjana@ccs.co.th",        phone:"082-345-6789", province:"เชียงใหม่",    category:"โรงงาน", status:"active",   projects:1, joinDate:"2025-11-03", owner:"วิภา รัตนกุล",    initials:"กม", color:"#059669", totalValue:3200000 },
  { id:3, name:"คุณประยุทธ ร.",        company:"หจก. ราชบุรีโลหะ",      type:"บริษัท", email:"prayuth@rajburi.co.th",    phone:"083-456-7890", province:"ราชบุรี",      category:"โรงงาน", status:"active",   projects:1, joinDate:"2026-01-20", owner:"วิภา รัตนกุล",    initials:"ปร", color:"#f59e0b", totalValue:760000 },
  { id:4, name:"คุณดารัล ส.",          company:"บจ. สมุทรโกดัง",        type:"บริษัท", email:"darat@smgodown.co.th",     phone:"084-567-8901", province:"สมุทรปราการ", category:"โกดัง/คลังสินค้า",  status:"active",   projects:2, joinDate:"2026-02-10", owner:"สมชาย เชียงใหม่",  initials:"ดส", color:"#dc2626", totalValue:2000000 },
  { id:5, name:"VCS Asia (ระยอง)",     company:"VCS Asia Co., Ltd.",     type:"บริษัท", email:"vcs@vcsasia.com",           phone:"085-678-9012", province:"ระยอง",        category:"โรงงาน", status:"inactive", projects:3, joinDate:"2025-08-01", owner:"วิชัย ประสิทธิ์",  initials:"VC", color:"#002244", totalValue:6200000 },
  { id:6, name:"คุณสุรัตน์ ล.",        company:"บจ. แม่สอดโลหะ",       type:"บริษัท", email:"surat@maesot.co.th",       phone:"086-789-0123", province:"ตาก",           category:"โกดัง/คลังสินค้า",  status:"active",   projects:1, joinDate:"2025-12-01", owner:"สมชาย เชียงใหม่",  initials:"สล", color:"#8fa3b8", totalValue:4100000 },
  { id:7, name:"บจ. อุตรดิตถ์โลหะ",   company:"บจ. อุตรดิตถ์โลหะ",    type:"บริษัท", email:"info@uttaradit.co.th",      phone:"087-890-1234", province:"อุตรดิตถ์",    category:"เกษตรกรรม",status:"inactive", projects:0, joinDate:"2026-06-01", owner:"วิภา รัตนกุล",    initials:"อต", color:"#8fa3b8", totalValue:0 },
  { id:8, name:"บจ. นครสวรรค์โลหะ",   company:"บจ. นครสวรรค์โลหะ",    type:"บริษัท", email:"nakhon@nsloha.co.th",      phone:"088-901-2345", province:"นครสวรรค์",    category:"อื่นๆ", status:"active",   projects:2, joinDate:"2025-07-15", owner:"กาญจนา มีสุข",    initials:"นส", color:"#059669", totalValue:5400000 },
];

// ─── แม่แบบอาคาร (Building Templates — กำหนดโดย HQ, ดีลเลอร์ดูอย่างเดียว) ───
// แหล่งข้อมูลกลาง: ใช้ทั้งหน้า "แม่แบบ" (/products) และ dropdown "แม่แบบที่สนใจ" ในฟอร์มผู้สนใจ
export type SolutionPriceHistory = { price: number; effectiveDate: string; note?: string };
export type SolutionProduct = {
  id: string; name: string; spec: string;
  price: number; unit: string; effectiveDate: string; priceHistory: SolutionPriceHistory[];
};
export const solutionProducts: SolutionProduct[] = [
  { id: "tpl-1", name: "โกดังสำเร็จรูป", spec: "โครงสร้างเหล็กระบบข้อต่อสลักเกลียว ไม่มีเสากลาง เพิ่มพื้นที่ใช้สอย · เหมาะคลังสินค้า โกดังเก็บสินค้าเกษตร และโกดังอุตสาหกรรม", price: 5100, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 4950, effectiveDate: "1 ม.ค. 2569", note: "ปรับตามราคาเหล็ก" }, { price: 4800, effectiveDate: "1 ก.ค. 2568" } ] },
  { id: "tpl-2", name: "โรงงาน", spec: "รองรับมาตรฐานโรงงานผลิตคุณภาพสูง และโรงงานอัจฉริยะที่เชื่อมต่อระบบอัตโนมัติได้ · ช่วงเสากว้าง รับน้ำหนักเครนได้", price: 6800, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 6600, effectiveDate: "1 ม.ค. 2569" }, { price: 6400, effectiveDate: "1 ก.ค. 2568" } ] },
  { id: "tpl-3", name: "อาคารสำเร็จรูปทุกประเภท", spec: "ปรับผังใช้งานได้หลายรูปแบบ เช่น สำนักงาน โรงเรียน สถานพยาบาล และอาคารพาณิชย์ · โครงเหล็กมาตรฐาน ติดตั้งเร็ว", price: 6200, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 6000, effectiveDate: "1 ม.ค. 2569" } ] },
  { id: "tpl-4", name: "งานตามแบบของลูกค้า", spec: "ออกแบบผังตามความต้องการเฉพาะโครงการของลูกค้า · ปรับผนัง ประตู และช่องเปิดได้ตามแบบ", price: 7000, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 6800, effectiveDate: "1 ม.ค. 2569", note: "ราคาเริ่มต้นแบบพิเศษ" } ] },
  { id: "tpl-5", name: "งานรีโนเวท", spec: "ปรับปรุงและต่อเติมอาคารระบบสำเร็จรูปเดิมให้ใช้งานได้ดีขึ้น ประหยัดกว่าสร้างใหม่ · ประเมินหน้างานก่อนเสนอราคา", price: 4500, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 4300, effectiveDate: "1 ม.ค. 2569" } ] },
  { id: "tpl-6", name: "สนามกีฬาในร่ม", spec: "โครงสร้างช่วงกว้างไม่มีเสากลางขวางกั้น เพดานสูง เหมาะสนามกีฬาในร่มทุกรูปแบบ", price: 7400, unit: "ตร.ม.", effectiveDate: "1 มิ.ย. 2569", priceHistory: [ { price: 7150, effectiveDate: "1 ม.ค. 2569" } ] },
];

// ─── QUOTATIONS ───────────────────────────────────────────────
export type QuotationStatus = "draft" | "sent_to_client" | "viewed" | "won" | "lost" | "expired";

export type QuotationMock = {
  id: string; customer: string; project: string;
  total: string; totalValue: number;
  materialCost: number;
  province: string; buildingType: string; area: number;
  status: QuotationStatus; date: string; items: number;
  customerId: number;
  projectId: number;
  revision?: string; // เวอร์ชันใบเสนอราคา V1/V2/V3
  expiry?: string;   // วันหมดอายุใบเสนอราคา (Expiry Date)
};

// สถานะใบเสนอราคาตามสเปก: Draft / Sent / Viewed / Accepted / Rejected / Expired
export const quotationStatusLabel: Record<QuotationStatus, string> = {
  draft: "ร่าง", sent_to_client: "ส่งแล้ว", viewed: "เปิดอ่านแล้ว",
  won: "ตอบรับ", lost: "ปฏิเสธ", expired: "หมดอายุ",
};
export const quotationStatusColor: Record<QuotationStatus, { bg: string; text: string }> = {
  draft:          { bg: "#f0f0f5", text: "#6b7280" },
  sent_to_client: { bg: "#dce5f0", text: "#003366" },
  viewed:         { bg: "#e0e7ff", text: "#4338ca" },
  won:            { bg: "#e5faf0", text: "#059669" },
  lost:           { bg: "#f5f5f5", text: "#9ca3af" },
  expired:        { bg: "#f5f5f5", text: "#9ca3af" },
};

export const quotations: QuotationMock[] = [
  { id: "Q-2026-0089", customer: "บจ. ไทยสตีล", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", total: "฿1,800,000", totalValue: 1800000, materialCost: 1800000, province: "นนทบุรี", buildingType: "โกดังสินค้า", area: 960, status: "won", date: "2026-05-15", items: 8, customerId: 1, projectId: 1 },
  { id: "Q-2026-0091", customer: "หจก. ราชบุรีโลหะ", project: "โกดังสำเร็จรูป ราชบุรี", total: "฿760,000", totalValue: 760000, materialCost: 760000, province: "ราชบุรี", buildingType: "โกดังสินค้า", area: 480, status: "sent_to_client", date: "2026-06-01", items: 5, customerId: 3, projectId: 5 },
  { id: "Q-2026-0092", customer: "VCS Asia", project: "โกดังระยอง VCS Asia", total: "฿6,200,000", totalValue: 6200000, materialCost: 6200000, province: "ระยอง", buildingType: "โรงงาน", area: 3200, status: "won", date: "2025-11-10", items: 15, customerId: 5, projectId: 8 },
  { id: "Q-2026-0095", customer: "บจ. ซีซีเอส", project: "โรงงาน PREFAB เชียงใหม่", total: "฿3,200,000", totalValue: 3200000, materialCost: 3200000, province: "เชียงใหม่", buildingType: "โรงงาน", area: 1800, status: "sent_to_client", date: "2026-06-10", items: 12, customerId: 2, projectId: 2 },
  { id: "Q-2026-0097", customer: "บจ. สมุทรโกดัง", project: "โกดังปากน้ำ พระปราชญ์", total: "฿2,000,000", totalValue: 2000000, materialCost: 2000000, province: "สมุทรปราการ", buildingType: "โกดังสินค้า", area: 1200, status: "sent_to_client", date: "2026-06-18", items: 7, customerId: 4, projectId: 3 },
  { id: "Q-2026-0098", customer: "บจ. อุตรดิตถ์โลหะ", project: "อาคารสำเร็จรูป อุตรดิตถ์", total: "฿2,800,000", totalValue: 2800000, materialCost: 2800000, province: "อุตรดิตถ์", buildingType: "โรงงาน", area: 1600, status: "draft", date: "2026-06-20", items: 9, customerId: 7, projectId: 7 },
  { id: "Q-2026-0099", customer: "บจ. นครสวรรค์โลหะ", project: "โรงงาน Custom นครสวรรค์", total: "฿5,400,000", totalValue: 5400000, materialCost: 5400000, province: "นครสวรรค์", buildingType: "โรงงาน", area: 2800, status: "won", date: "2026-04-05", items: 18, customerId: 8, projectId: 6 },
  { id: "Q-2026-0100", customer: "บจ. เชียงรายเมทัล", project: "โกดัง EASYBUILD เชียงราย", total: "฿1,500,000", totalValue: 1500000, materialCost: 1500000, province: "เชียงราย", buildingType: "โกดังสินค้า", area: 720, status: "lost", date: "2026-05-28", items: 6, customerId: 9, projectId: 9 },
];

// ─── TEAM ─────────────────────────────────────────────────────
export type TeamMock = {
  id: number; name: string; role: string; dept: string;
  initials: string; color: string; tasks: number; projects: number; phone: string;
};

export const teamRoleLabel: Record<string, string> = {
  DEALER_ADMIN: "ผู้จัดการ", DEALER_SALES: "เซลส์", DEALER_SITE: "เซลส์ภาคสนาม",
};

export const team: TeamMock[] = [
  { id: 1, name: "สมชาย เชียงใหม่",  role: "DEALER_ADMIN", dept: "บริหาร",    initials: "สช", color: "#003366", tasks: 5, projects: 4, phone: "081-234-5678" },
  { id: 2, name: "วิภา รัตนกุล",      role: "DEALER_SALES", dept: "ขาย",       initials: "วร", color: "#059669", tasks: 3, projects: 3, phone: "082-345-6789" },
  { id: 3, name: "วิชัย ประสิทธิ์",   role: "DEALER_SITE",  dept: "ขายภาคสนาม",  initials: "วป", color: "#f59e0b", tasks: 4, projects: 2, phone: "083-456-7890" },
  { id: 4, name: "กาญจนา มีสุข",      role: "DEALER_SALES", dept: "ขาย",       initials: "กม", color: "#8fa3b8", tasks: 2, projects: 2, phone: "084-567-8901" },
  { id: 5, name: "ประสิทธิ์ ดีงาน",   role: "DEALER_SITE",  dept: "ขายภาคสนาม",  initials: "ปด", color: "#002244", tasks: 1, projects: 1, phone: "085-678-9012" },
  { id: 6, name: "สุดาวรรณ สวยงาม",   role: "DEALER_SALES", dept: "ขาย",       initials: "สส", color: "#8fa3b8", tasks: 2, projects: 2, phone: "086-789-0123" },
];

// ─── HQ MOCK DATA ─────────────────────────────────────────────

// KPI รวมทั้งเครือ
export const hqKpis = [
  { key: "revenue",  label: "ยอดขายรวมเดือนนี้", value: "฿18.4M", delta: 12.3, icon: "dollar",   currentNum: 18.4, targetNum: 22,  unit: "M", targetLabel: "฿22M" },
  { key: "pipeline", label: "โอกาสการขายรวม",     value: "฿54.2M", delta: 6.8,  icon: "trending", currentNum: 54.2, targetNum: 60,  unit: "M", targetLabel: "฿60M" },
  { key: "won",     label: "โอกาสการขายที่ชนะ (YTD)",    value: "18",     delta: 22.1, icon: "award",   currentNum: 18,  targetNum: 24,  unit: "",  targetLabel: "24 รายการ" },
  { key: "winrate", label: "อัตราปิดการขายรวม",   value: "38%",    delta: 4.1,  icon: "target",  currentNum: 38,  targetNum: 45,  unit: "%", targetLabel: "45%" },
];

// สาขา Benjamin
export type DealerCredentials = { email: string; password: string };

export type DealerRow = {
  id: string;
  code: string;
  name: string;
  region: string;
  revenueActual: number;
  revenueTarget: number;
  winRate: number;
  activeProjects: number;
  onTimePct: number;
  status: "active" | "inactive";
  credentials: DealerCredentials;
};

export const dealerLeaderboard: DealerRow[] = [
  { id: "RYG", code: "RYG", name: "Benjamin สาขาระยอง",      region: "ตะวันออก", revenueActual: 5400000, revenueTarget: 6000000, winRate: 48, activeProjects: 6, onTimePct: 91, status: "active",   credentials: { email: "ryg@benjamin.co.th", password: "PEB-RYG-4821" } },
  { id: "CNX", code: "CNX", name: "Benjamin สาขาเชียงใหม่",   region: "เหนือ",    revenueActual: 4200000, revenueTarget: 6200000, winRate: 35, activeProjects: 5, onTimePct: 78, status: "active",   credentials: { email: "cnx@benjamin.co.th", password: "PEB-CNX-3317" } },
  { id: "MST", code: "MST", name: "Benjamin สาขาแม่สอด",      region: "ตะวันตก", revenueActual: 3800000, revenueTarget: 5000000, winRate: 52, activeProjects: 4, onTimePct: 85, status: "active",   credentials: { email: "mst@benjamin.co.th", password: "PEB-MST-7749" } },
  { id: "CRI", code: "CRI", name: "Benjamin สาขาเชียงราย",    region: "เหนือ",    revenueActual: 3100000, revenueTarget: 5800000, winRate: 41, activeProjects: 3, onTimePct: 72, status: "active",   credentials: { email: "cri@benjamin.co.th", password: "PEB-CRI-5563" } },
  { id: "NSN", code: "NSN", name: "Benjamin สาขานครสวรรค์",   region: "กลาง",     revenueActual: 1900000, revenueTarget: 5000000, winRate: 29, activeProjects: 2, onTimePct: 61, status: "active",   credentials: { email: "nsn@benjamin.co.th", password: "PEB-NSN-2294" } },
  { id: "HYI", code: "HYI", name: "Benjamin สาขาหาดใหญ่",    region: "ใต้",      revenueActual: 920000,  revenueTarget: 4000000, winRate: 18, activeProjects: 1, onTimePct: 0,  status: "inactive", credentials: { email: "hyi@benjamin.co.th", password: "PEB-HYI-1108" } },
];

// Lead pool กลาง (ยังไม่มอบหมาย dealer)
export type LeadPoolRow = {
  id: string;
  name: string;
  province: string;
  channel: string;
  product: string;
  value: string;
  valueNum: number;   // numeric สำหรับ sort
  createdAt: string;
  waitHours: number;  // จำนวนชั่วโมงที่รอ (ใช้คำนวณ SLA)
};

export const leadPool: LeadPoolRow[] = [
  { id: "#LP-001", name: "บจ. อุตรดิตถ์โลหะ",      province: "อุตรดิตถ์",    channel: "เว็บไซต์", product: "RANBUILD",  value: "฿2.8M", valueNum: 2800000, createdAt: "วันนี้ 09:14",    waitHours: 4  },
  { id: "#LP-002", name: "คุณพรทิพย์ ว.",            province: "ลำปาง",        channel: "LINE OA",  product: "EASYBUILD", value: "฿650K", valueNum:  650000, createdAt: "วันนี้ 08:32",    waitHours: 5  },
  { id: "#LP-003", name: "หจก. พะเยาสตีล",       province: "พะเยา",        channel: "เว็บไซต์", product: "PREFAB",    value: "฿1.1M", valueNum: 1100000, createdAt: "เมื่อวาน 17:05",  waitHours: 28 },
  { id: "#LP-004", name: "บจ. โคราชอุตสาหกรรม",      province: "นครราชสีมา",   channel: "เว็บไซต์", product: "EASYBUILD", value: "฿3.4M", valueNum: 3400000, createdAt: "เมื่อวาน 14:20",  waitHours: 45 },
  { id: "#LP-005", name: "หจก. ชลบุรีคลังสินค้า",    province: "ชลบุรี",       channel: "LINE OA",  product: "RANBUILD",  value: "฿1.9M", valueNum: 1900000, createdAt: "2 วันก่อน",       waitHours: 56 },
];

// แผนที่ จังหวัด → ภาค (ใช้แนะนำสาขาที่รับผิดชอบตอนมอบหมายลีด)
export const provinceToRegion: Record<string, string> = {
  // เหนือ
  เชียงใหม่: "เหนือ", เชียงราย: "เหนือ", ลำปาง: "เหนือ", ลำพูน: "เหนือ", พะเยา: "เหนือ",
  แพร่: "เหนือ", น่าน: "เหนือ", อุตรดิตถ์: "เหนือ", แม่ฮ่องสอน: "เหนือ",
  // กลาง
  กรุงเทพมหานคร: "กลาง", นนทบุรี: "กลาง", ปทุมธานี: "กลาง", สมุทรปราการ: "กลาง",
  สมุทรสาคร: "กลาง", นครสวรรค์: "กลาง", พระนครศรีอยุธยา: "กลาง", สุพรรณบุรี: "กลาง",
  สระบุรี: "กลาง", ลพบุรี: "กลาง", พิษณุโลก: "กลาง",
  // ตะวันออก
  ระยอง: "ตะวันออก", ชลบุรี: "ตะวันออก", จันทบุรี: "ตะวันออก", ตราด: "ตะวันออก",
  ฉะเชิงเทรา: "ตะวันออก", ปราจีนบุรี: "ตะวันออก", สระแก้ว: "ตะวันออก",
  // ตะวันตก
  ราชบุรี: "ตะวันตก", กาญจนบุรี: "ตะวันตก", เพชรบุรี: "ตะวันตก",
  ประจวบคีรีขันธ์: "ตะวันตก", ตาก: "ตะวันตก", สมุทรสงคราม: "ตะวันตก",
  // ใต้
  สงขลา: "ใต้", ภูเก็ต: "ใต้", สุราษฎร์ธานี: "ใต้", นครศรีธรรมราช: "ใต้", กระบี่: "ใต้", ตรัง: "ใต้",
  // อีสาน
  นครราชสีมา: "อีสาน", ขอนแก่น: "อีสาน", อุดรธานี: "อีสาน", อุบลราชธานี: "อีสาน", บุรีรัมย์: "อีสาน",
};

export function regionOfProvince(province: string): string {
  return provinceToRegion[province] ?? "";
}

// ยอดขายรายเดือน (รวมทั้งเครือ)
export const hqSalesByMonth = [
  { month: "ม.ค.",   value: 11.4, prevValue: 9.8  },
  { month: "ก.พ.",  value: 10.3, prevValue: 11.1 },
  { month: "มี.ค.", value: 15.1, prevValue: 12.7 },
  { month: "เม.ย.", value: 19.2, prevValue: 16.0 },
  { month: "พ.ค.",  value: 13.3, prevValue: 14.4 },
  { month: "มิ.ย.", value: 18.4, prevValue: 15.2 },
  { month: "ก.ค.",  value: 14.6, prevValue: 16.5 },
  { month: "ส.ค.",  value: 22.2, prevValue: 19.0 },
];

// กิจกรรมล่าสุดทั้งเครือ
export type ActivityKind = "win" | "lead" | "approve" | "assign";
export type ActivityItem = {
  kind: ActivityKind;
  text: string;
  branch: string;
  time: string;
};

export const hqRecentActivity: ActivityItem[] = [
  { kind: "win",     text: "ปิดงาน โกดัง VCS Asia ฿6.2M",               branch: "ระยอง",     time: "30 นาที" },
  { kind: "lead",    text: "ลีดใหม่: หจก. ชลบุรีคลังสินค้า ฿1.9M",       branch: "ส่วนกลาง",  time: "2 ชม." },
  { kind: "lead",    text: "ส่งใบเสนอราคา Q-2026-0097 สมุทรปราการ ฿2.0M", branch: "เชียงใหม่",  time: "3 ชม." },
  { kind: "assign",  text: "มอบหมาย LP-004 โคราช → สาขาระยอง",           branch: "ส่วนกลาง",  time: "5 ชม." },
  { kind: "win",     text: "ปิดการขาย EASYBUILD แม่สอด ฿4.1M",    branch: "แม่สอด",    time: "เมื่อวาน" },
  { kind: "win",     text: "ปิดงาน RANBUILD นครสวรรค์ ฿5.4M",           branch: "นครสวรรค์", time: "2 วัน" },
];

// ─── APPOINTMENTS ─────────────────────────────────────────────
export type ApptType = "visit" | "design_meet" | "presentation" | "contract_sign" | "close" | "follow_up";
export type ApptStatus = "upcoming" | "done" | "cancelled";

export const apptTypeLabel: Record<ApptType, string> = {
  visit: "นัดพบลูกค้า",
  design_meet: "นัดนำเสนอสินค้า",
  presentation: "นำเสนอราคา",
  contract_sign: "เซ็นสัญญาซื้อขาย",
  close: "ปิดการขาย",
  follow_up: "โทรติดตาม",
};

export const apptTypeColor: Record<ApptType, { bg: string; text: string }> = {
  visit:         { bg: "#dce5f0", text: "#003366" },
  design_meet:   { bg: "#f0f4f8", text: "#2D2D2D" },
  presentation:  { bg: "#fef3cd", text: "#f59e0b" },
  contract_sign: { bg: "#dce5f0", text: "#003366" },
  close:         { bg: "#e5faf0", text: "#059669" },
  follow_up:     { bg: "#f0f0f5", text: "#6b7280" },
};

export const apptStatusLabel: Record<ApptStatus, string> = {
  upcoming: "กำลังจะมาถึง", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
export const apptStatusColor: Record<ApptStatus, { bg: string; text: string }> = {
  upcoming:  { bg: "#dce5f0", text: "#003366" },
  done:      { bg: "#e5faf0", text: "#059669" },
  cancelled: { bg: "#fee2e2", text: "#dc2626" },
};

export type AppointmentMock = {
  id: number; company: string; contact: string; phone: string;
  project: string; buildingType: string; area: number; province: string;
  date: string; time: string; type: ApptType; assigned: string;
  status: ApptStatus; note: string;
};

export const appointments: AppointmentMock[] = [
  { id: 1, company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", buildingType: "อาคารสำเร็จรูป", area: 1200, province: "นนทบุรี", date: "2026-06-24", time: "09:00", type: "visit", assigned: "สมชาย", status: "upcoming", note: "นัดพบลูกค้าคุยความต้องการโกดังสินค้า" },
  { id: 2, company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", project: "โรงงานสำเร็จรูป บจ. ซีซีเอส", buildingType: "อาคารสำเร็จรูป", area: 800, province: "เชียงใหม่", date: "2026-06-24", time: "13:30", type: "design_meet", assigned: "วิภา", status: "upcoming", note: "นำเสนอแบบและสเปกสินค้า" },
  { id: 3, company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", buildingType: "อาคารสำเร็จรูป", area: 1200, province: "นนทบุรี", date: "2026-06-26", time: "09:00", type: "contract_sign", assigned: "สมชาย", status: "upcoming", note: "เซ็นสัญญาซื้อขาย" },
  { id: 4, company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", project: "โรงงานสำเร็จรูป บจ. ซีซีเอส", buildingType: "อาคารสำเร็จรูป", area: 800, province: "เชียงใหม่", date: "2026-06-30", time: "13:00", type: "follow_up", assigned: "สมชาย", status: "upcoming", note: "ติดตามผลใบเสนอราคา" },
  { id: 5, company: "บจ. สมุทรโกดัง", contact: "คุณดารัล ส.", phone: "084-567-8901", project: "โกดังปากน้ำ พระปราชญ์", buildingType: "อาคารสำเร็จรูป", area: 2000, province: "สมุทรปราการ", date: "2026-07-03", time: "08:00", type: "visit", assigned: "วิชัย", status: "upcoming", note: "นัดพบลูกค้าเก็บความต้องการ" },
  { id: 6, company: "หจก. ราชบุรีโลหะ", contact: "คุณประยุทธ ร.", phone: "083-456-7890", project: "โกดังสำเร็จรูป ราชบุรี", buildingType: "โกดังสำเร็จรูป", area: 3100, province: "ราชบุรี", date: "2026-07-05", time: "10:00", type: "presentation", assigned: "วิภา", status: "upcoming", note: "นำเสนอใบเสนอราคาฉบับปรับปรุง" },
  { id: 7, company: "บจ. แม่สอดโลหะ", contact: "คุณสุรัตน์ ล.", phone: "086-789-0123", project: "อาคารสำเร็จรูป แม่สอด", buildingType: "อาคารสำเร็จรูป", area: 4100, province: "ตาก", date: "2026-06-15", time: "10:00", type: "visit", assigned: "สมชาย", status: "done", note: "พบลูกค้าเรียบร้อย รอติดตามผล" },
  { id: 8, company: "VCS Asia", contact: "VCS Asia (ระยอง)", phone: "085-678-9012", project: "โกดังระยอง VCS Asia", buildingType: "โกดังสำเร็จรูป", area: 6200, province: "ระยอง", date: "2026-02-25", time: "13:00", type: "close", assigned: "วิชัย", status: "done", note: "ปิดการขายเรียบร้อย" },
  { id: 9, company: "บจ. นครสวรรค์โลหะ", contact: "บจ. นครสวรรค์โลหะ", phone: "088-901-2345", project: "โรงงานสำเร็จรูป นครสวรรค์", buildingType: "โรงงานสำเร็จรูป", area: 5400, province: "นครสวรรค์", date: "2026-03-15", time: "14:00", type: "follow_up", assigned: "กาญจนา", status: "done", note: "โทรติดตามหลังปิดการขาย" },
  { id: 10, company: "บจ. อุตรดิตถ์โลหะ", contact: "บจ. อุตรดิตถ์โลหะ", phone: "087-890-1234", project: "อาคารสำเร็จรูป อุตรดิตถ์", buildingType: "อาคารสำเร็จรูป", area: 2800, province: "อุตรดิตถ์", date: "2026-07-10", time: "10:00", type: "presentation", assigned: "วิภา", status: "cancelled", note: "ลูกค้าขอเลื่อน" },
];

// ─── MESSAGES ─────────────────────────────────────────────────────
export type MessageMock = {
  id: number; text: string; senderName: string; senderId: string; created: string;
};
export const messages: MessageMock[] = [
  { id: 1, text: "ใบเสนอราคาโกดัง VCS Asia ลูกค้าอนุมัติแล้ว เตรียมทำสัญญาได้เลย", senderName: "สุรชัย", senderId: "surachai", created: "2026-06-20 09:15" },
  { id: 2, text: "ลูกค้า บจ. ซีซีเอส โอนเงินมัดจำมาแล้ว 30% รอตรวจสอบ statement", senderName: "วิภา", senderId: "wipa", created: "2026-06-20 10:30" },
  { id: 3, text: "โอกาสการขาย TKT-002 ลูกค้ายืนยันสั่งซื้อแล้ว รอทำเอกสาร 3-5 วันทำการ", senderName: "สมชาย", senderId: "somchai", created: "2026-06-21 14:00" },
  { id: 4, text: "นัดพบลูกค้าใหม่ที่นครสวรรค์ วันศุกร์ที่ 26 มิ.ย. เวลา 10:00", senderName: "กาญจนา", senderId: "kanchana", created: "2026-06-22 08:45" },
];

// ─── TAGS ─────────────────────────────────────────────────────────
export type TagVisibility = "public" | "team" | "private";
export type TagMock = {
  id: number; title: string; visibility: TagVisibility; color: string; created: string;
};
export const tags: TagMock[] = [
  { id: 1, title: "VIP", visibility: "public", color: "#f59e0b", created: "2026-01-01" },
  { id: 2, title: "ลูกค้าประจำ", visibility: "public", color: "#059669", created: "2026-01-01" },
  { id: 3, title: "ติดตามด่วน", visibility: "team", color: "#dc2626", created: "2026-02-01" },
  { id: 4, title: "โอกาสการขายใหญ่", visibility: "public", color: "#003366", created: "2026-02-01" },
  { id: 5, title: "รอเสนอราคา", visibility: "team", color: "#6b7280", created: "2026-03-01" },
];

// ─── DEALER DRILL-DOWN ────────────────────────────────────────
export type DealerLeadItem = {
  id: string; name: string; province: string; product: string;
  valueNum: number; status: "new" | "contacted" | "quoted" | "won" | "lost";
  assignedAt: string;
};
export type DealerProjectItem = {
  id: string; name: string; product: string;
  valueNum: number; progress: number;
  status: "in_progress" | "completed" | "on_hold" | "overdue";
  dueDate: string;
};
export type DealerQuoteItem = {
  quoteNo: string; customer: string; product: string;
  valueNum: number; discountPct: number;
  status: "draft" | "sent" | "won" | "lost";
  date: string;
};
export type DealerDetail = {
  code: string;
  monthlySales: { month: string; value: number }[];
  leads: DealerLeadItem[];
  projects: DealerProjectItem[];
  quotes: DealerQuoteItem[];
};

export const dealerDetails: Record<string, DealerDetail> = {
  RYG: {
    code: "RYG",
    monthlySales: [
      { month: "ม.ค.", value: 3200 }, { month: "ก.พ.", value: 6200 }, { month: "มี.ค.", value: 4800 },
      { month: "เม.ย.", value: 5600 }, { month: "พ.ค.", value: 7100 }, { month: "มิ.ย.", value: 5400 },
    ],
    leads: [
      { id: "LD-R01", name: "บจ. แหลมฉบัง อุตสาหกรรม", province: "ชลบุรี",    product: "RANBUILD",  valueNum: 4200000, status: "quoted",    assignedAt: "3 วันก่อน" },
      { id: "LD-R02", name: "หจก. มาบตาพุดโลหะ",       province: "ระยอง",     product: "EASYBUILD", valueNum: 1800000, status: "contacted", assignedAt: "1 สัปดาห์" },
      { id: "LD-R03", name: "บจ. ชลอุตสาหกรรม",        province: "ชลบุรี",    product: "PREFAB",    valueNum: 2600000, status: "new",       assignedAt: "2 วันก่อน" },
      { id: "LD-R04", name: "นาย อนันต์ ศ.",            province: "จันทบุรี",  product: "EASYBUILD", valueNum: 850000,  status: "won",       assignedAt: "2 สัปดาห์" },
    ],
    projects: [
      { id: "PRJ-R01", name: "โกดัง VCS Asia ระยอง",        product: "RANBUILD",  valueNum: 6200000, progress: 100, status: "completed",  dueDate: "28 ก.พ. 2026" },
      { id: "PRJ-R02", name: "โรงงาน บจ. แหลมฉบัง",         product: "PREFAB",    valueNum: 3800000, progress: 62,  status: "in_progress", dueDate: "31 ส.ค. 2026" },
      { id: "PRJ-R03", name: "โกดัง มาบตาพุดโลหะ",           product: "EASYBUILD", valueNum: 1800000, progress: 38,  status: "in_progress", dueDate: "15 ก.ย. 2026" },
      { id: "PRJ-R04", name: "คลังสินค้า ชลบุรี เฟส 2",       product: "RANBUILD",  valueNum: 2400000, progress: 10,  status: "in_progress", dueDate: "30 ต.ค. 2026" },
      { id: "PRJ-R05", name: "โกดัง จันทบุรี อนันต์",         product: "EASYBUILD", valueNum: 850000,  progress: 0,   status: "in_progress", dueDate: "15 พ.ย. 2026" },
      { id: "PRJ-R06", name: "โรงงาน ตราด อุตสาหกรรม",        product: "RANBUILD",  valueNum: 3100000, progress: 0,   status: "in_progress", dueDate: "31 ธ.ค. 2026" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0091", customer: "หจก. ราชบุรีโลหะ",      product: "RANBUILD",  valueNum: 1800000, discountPct: 12, status: "sent", date: "3 ชม." },
      { quoteNo: "Q-2026-0086", customer: "บจ. แหลมฉบัง อุตฯ",     product: "PREFAB",    valueNum: 3800000, discountPct: 8,  status: "sent",     date: "2 วัน" },
      { quoteNo: "Q-2026-0079", customer: "หจก. มาบตาพุดโลหะ",      product: "EASYBUILD", valueNum: 1800000, discountPct: 5,  status: "won",      date: "2 สัปดาห์" },
      { quoteNo: "Q-2026-0065", customer: "VCS Asia",                product: "RANBUILD",  valueNum: 6200000, discountPct: 0,  status: "won",      date: "4 สัปดาห์" },
    ],
  },
  CNX: {
    code: "CNX",
    monthlySales: [
      { month: "ม.ค.", value: 2100 }, { month: "ก.พ.", value: 1800 }, { month: "มี.ค.", value: 3200 },
      { month: "เม.ย.", value: 4100 }, { month: "พ.ค.", value: 2600 }, { month: "มิ.ย.", value: 4200 },
    ],
    leads: [
      { id: "LD-C01", name: "บจ. ไทยสตีล",          province: "เชียงใหม่",  product: "EASYBUILD", valueNum: 3200000, status: "quoted",    assignedAt: "5 วันก่อน" },
      { id: "LD-C02", name: "หจก. สันทรายเมทัล",  province: "เชียงใหม่",  product: "PREFAB",    valueNum: 1200000, status: "contacted", assignedAt: "1 สัปดาห์" },
      { id: "LD-C03", name: "บจ. ลำพูนโลหะ",         province: "ลำพูน",      product: "RANBUILD",  valueNum: 2800000, status: "new",       assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-C01", name: "โกดัง บจ. ไทยสตีล เชียงใหม่",  product: "EASYBUILD", valueNum: 3200000, progress: 45, status: "in_progress", dueDate: "31 ก.ค. 2026" },
      { id: "PRJ-C02", name: "โรงงาน PREFAB ซีซีเอส",          product: "PREFAB",    valueNum: 3200000, progress: 72, status: "in_progress", dueDate: "15 ส.ค. 2026" },
      { id: "PRJ-C03", name: "คลังสินค้า ลำพูน อุตฯ",          product: "RANBUILD",  valueNum: 1600000, progress: 0,  status: "in_progress", dueDate: "30 ก.ย. 2026" },
      { id: "PRJ-C04", name: "โกดัง เชียงใหม่-ลำปาง",          product: "EASYBUILD", valueNum: 2100000, progress: 25, status: "on_hold",     dueDate: "31 ต.ค. 2026" },
      { id: "PRJ-C05", name: "โรงงาน น่าน CUSTOM",             product: "CUSTOM",    valueNum: 4800000, progress: 5,  status: "in_progress", dueDate: "28 ก.พ. 2027" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0089", customer: "บจ. ไทยสตีล",       product: "EASYBUILD", valueNum: 3200000, discountPct: 15, status: "sent", date: "2 ชม." },
      { quoteNo: "Q-2026-0083", customer: "หจก. สันทราย",       product: "PREFAB",    valueNum: 1200000, discountPct: 6,  status: "sent",     date: "4 วัน" },
      { quoteNo: "Q-2026-0074", customer: "บจ. ลำพูนโลหะ",     product: "RANBUILD",  valueNum: 2800000, discountPct: 4,  status: "draft",    date: "1 สัปดาห์" },
    ],
  },
  MST: {
    code: "MST",
    monthlySales: [
      { month: "ม.ค.", value: 1800 }, { month: "ก.พ.", value: 2400 }, { month: "มี.ค.", value: 3100 },
      { month: "เม.ย.", value: 4200 }, { month: "พ.ค.", value: 3600 }, { month: "มิ.ย.", value: 3800 },
    ],
    leads: [
      { id: "LD-M01", name: "บจ. แม่สอดโลหะ",        province: "ตาก",    product: "EASYBUILD", valueNum: 4100000, status: "quoted",    assignedAt: "3 วันก่อน" },
      { id: "LD-M02", name: "หจก. กาญจน์อุตฯ",       province: "กาญจนบุรี", product: "RANBUILD", valueNum: 2200000, status: "contacted", assignedAt: "5 วันก่อน" },
      { id: "LD-M03", name: "นาย ธนกร ป.",            province: "ตาก",    product: "PREFAB",    valueNum: 980000,  status: "new",       assignedAt: "2 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-M01", name: "EASYBUILD แม่สอด บจ. แม่สอดโลหะ", product: "EASYBUILD", valueNum: 4100000, progress: 82, status: "in_progress", dueDate: "31 ก.ค. 2026" },
      { id: "PRJ-M02", name: "โกดัง RANBUILD กาญจนบุรี",         product: "RANBUILD",  valueNum: 2200000, progress: 55, status: "in_progress", dueDate: "30 ส.ค. 2026" },
      { id: "PRJ-M03", name: "โรงงาน PREFAB ตาก",                product: "PREFAB",    valueNum: 1600000, progress: 30, status: "in_progress", dueDate: "30 ก.ย. 2026" },
      { id: "PRJ-M04", name: "คลังสินค้า ราชบุรี",               product: "EASYBUILD", valueNum: 1800000, progress: 0,  status: "in_progress", dueDate: "31 ต.ค. 2026" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0085", customer: "บจ. แม่สอดโลหะ", product: "EASYBUILD", valueNum: 4100000, discountPct: 7,  status: "won",  date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0080", customer: "หจก. กาญจน์อุตฯ", product: "RANBUILD",  valueNum: 2200000, discountPct: 5,  status: "sent", date: "2 สัปดาห์" },
      { quoteNo: "Q-2026-0077", customer: "นาย ธนกร ป.",     product: "PREFAB",    valueNum: 980000,  discountPct: 3,  status: "draft", date: "2 สัปดาห์" },
    ],
  },
  CRI: {
    code: "CRI",
    monthlySales: [
      { month: "ม.ค.", value: 1200 }, { month: "ก.พ.", value: 900 }, { month: "มี.ค.", value: 2200 },
      { month: "เม.ย.", value: 3100 }, { month: "พ.ค.", value: 2800 }, { month: "มิ.ย.", value: 3100 },
    ],
    leads: [
      { id: "LD-CR01", name: "บจ. เชียงรายอุตสาหกรรม", province: "เชียงราย", product: "RANBUILD",  valueNum: 3600000, status: "quoted",    assignedAt: "4 วันก่อน" },
      { id: "LD-CR02", name: "หจก. พะเยาสตีล",    province: "พะเยา",    product: "PREFAB",    valueNum: 1100000, status: "new",       assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-CR01", name: "โรงงาน RANBUILD เชียงราย",     product: "RANBUILD",  valueNum: 3600000, progress: 40, status: "in_progress", dueDate: "30 ก.ย. 2026" },
      { id: "PRJ-CR02", name: "โกดัง EASYBUILD พะเยา",        product: "EASYBUILD", valueNum: 1800000, progress: 60, status: "in_progress", dueDate: "31 ส.ค. 2026" },
      { id: "PRJ-CR03", name: "PREFAB เชียงราย เฟส 1",        product: "PREFAB",    valueNum: 2100000, progress: 15, status: "overdue",     dueDate: "15 มิ.ย. 2026" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0082", customer: "บจ. เชียงรายอุตฯ", product: "RANBUILD",  valueNum: 3600000, discountPct: 9,  status: "sent",  date: "3 วัน" },
      { quoteNo: "Q-2026-0075", customer: "หจก. พะเยาสตีล", product: "PREFAB",  valueNum: 1100000, discountPct: 5,  status: "draft", date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0070", customer: "บจ. เชียงรายอุตฯ", product: "EASYBUILD", valueNum: 1800000, discountPct: 6,  status: "won",   date: "3 สัปดาห์" },
    ],
  },
  NSN: {
    code: "NSN",
    monthlySales: [
      { month: "ม.ค.", value: 5400 }, { month: "ก.พ.", value: 800 }, { month: "มี.ค.", value: 600 },
      { month: "เม.ย.", value: 400 }, { month: "พ.ค.", value: 500 }, { month: "มิ.ย.", value: 1900 },
    ],
    leads: [
      { id: "LD-N01", name: "บจ. นครสวรรค์โกดัง", province: "นครสวรรค์", product: "EASYBUILD", valueNum: 2400000, status: "contacted", assignedAt: "6 วันก่อน" },
      { id: "LD-N02", name: "หจก. สุโขทัยอุตฯ",  province: "สุโขทัย",   product: "RANBUILD",  valueNum: 1800000, status: "new",       assignedAt: "2 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-N01", name: "โรงงาน RANBUILD นครสวรรค์",    product: "RANBUILD",  valueNum: 5400000, progress: 100, status: "completed",  dueDate: "31 มี.ค. 2026" },
      { id: "PRJ-N02", name: "โกดัง EASYBUILD นครสวรรค์",    product: "EASYBUILD", valueNum: 1900000, progress: 20,  status: "in_progress", dueDate: "31 ส.ค. 2026" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0087", customer: "บจ. นครสวรรค์โกดัง", product: "EASYBUILD", valueNum: 2400000, discountPct: 8, status: "sent", date: "4 วัน" },
      { quoteNo: "Q-2026-0072", customer: "หจก. สุโขทัยอุตฯ",    product: "RANBUILD",  valueNum: 1800000, discountPct: 5, status: "draft", date: "1 สัปดาห์" },
    ],
  },
};

// ─── PIPELINE FUNNEL ─────────────────────────────────────────
export type PipelineStage = {
  key: string;
  label: string;
  count: number;
  valueNum: number;
  color: string;
};
export const hqPipelineStages: PipelineStage[] = [
  { key: "lead",      label: "ลีดใหม่",         count: 42, valueNum: 94200000, color: "#dce5f0" },
  { key: "contacted", label: "รวบรวมความต้องการ", count: 28, valueNum: 62400000, color: "#8fa3c0" },
  { key: "quoted",    label: "ใบเสนอราคา",      count: 16, valueNum: 38600000, color: "#4d7aa8" },
  { key: "negotiation", label: "เจรจาต่อรอง",   count: 9, valueNum: 22100000, color: "#1a5b8f" },
  { key: "won",       label: "ปิดการขาย",       count: 5,  valueNum: 14300000, color: "#003366" },
];

// สรุปดีลเดือนนี้ (HQ รวมทุกสาขา)
export const hqDealSummary = {
  won:         { count: 5,  value: 14300000 },
  lost:        { count: 4,  value: 9800000  },
  negotiating: { count: 16, value: 38600000 },
  // เป้าปีนี้ (annual) vs YTD จริง
  annualTarget: 260000000,
  ytdActual:    124600000,
  // leads รอติดตาม > 48 ชม.
  leadsOverdue: 5,
};

export type PipelineLostReason = { reason: string; count: number; pct: number };
export const hqPipelineLostReasons: PipelineLostReason[] = [
  { reason: "ราคาสูงกว่าคู่แข่ง",    count: 6, pct: 38 },
  { reason: "ลูกค้าเลื่อนการตัดสินใจ", count: 4, pct: 25 },
  { reason: "ลูกค้าติดต่อไม่ได้",     count: 3, pct: 19 },
  { reason: "เปลี่ยนประเภทอาคาร",     count: 2, pct: 13 },
  { reason: "อื่นๆ",                   count: 1, pct: 6 },
];

export type PipelineByProduct = { product: string; count: number; valueNum: number; color: string };
export const hqPipelineByProduct: PipelineByProduct[] = [
  { product: "RANBUILD",   count: 14, valueNum: 32400000, color: "#003366" },
  { product: "EASYBUILD",  count: 12, valueNum: 24600000, color: "#0a4f8c" },
  { product: "CUSTOM",     count: 8,  valueNum: 18900000, color: "#1e6fbf" },
  { product: "PREFAB",     count: 5,  valueNum: 11200000, color: "#8fa3b8" },
  { product: "TURNKEY",    count: 2,  valueNum: 5800000,  color: "#82b4e3" },
  { product: "CONSULTANT", count: 1,  valueNum: 1300000,  color: "#b8d4f0" },
];

// ─── HQ SALES TARGETS ────────────────────────────────────────────────────────

export type SalesTarget = {
  dealerCode: string;
  dealerName: string;
  region: string;
  annualTarget: number;
  q1Target: number; q1Actual: number;
  q2Target: number; q2Actual: number;
  q3Target: number;
  q4Target: number;
};

export const hqSalesTargets: SalesTarget[] = [
  { dealerCode:"RYG", dealerName:"สาขาระยอง",       region:"ตะวันออก", annualTarget:30000000, q1Target:7000000, q1Actual:7200000, q2Target:8000000, q2Actual:6100000, q3Target:8000000, q4Target:7000000 },
  { dealerCode:"CNX", dealerName:"สาขาเชียงใหม่",   region:"เหนือ",    annualTarget:20000000, q1Target:5000000, q1Actual:5800000, q2Target:5000000, q2Actual:4200000, q3Target:5000000, q4Target:5000000 },
  { dealerCode:"MST", dealerName:"สาขาแม่สอด",      region:"ตะวันตก",  annualTarget:15000000, q1Target:3500000, q1Actual:3900000, q2Target:4000000, q2Actual:3100000, q3Target:4000000, q4Target:3500000 },
  { dealerCode:"CRI", dealerName:"สาขาเชียงราย",    region:"เหนือ",    annualTarget:12000000, q1Target:3000000, q1Actual:2400000, q2Target:3000000, q2Actual:2800000, q3Target:3000000, q4Target:3000000 },
  { dealerCode:"NSN", dealerName:"สาขานครสวรรค์",   region:"กลาง",     annualTarget:8000000,  q1Target:2000000, q1Actual:1900000, q2Target:2000000, q2Actual:1200000, q3Target:2000000, q4Target:2000000 },
  { dealerCode:"HYI", dealerName:"สาขาหาดใหญ่",    region:"ใต้",      annualTarget:6000000,  q1Target:1500000, q1Actual:800000,  q2Target:1500000, q2Actual:500000,  q3Target:1500000, q4Target:1500000 },
];

// ─── HQ ALL CUSTOMERS ────────────────────────────────────────────────────────

export type HQCustomer = {
  id: number;
  name: string;
  dealerCode: string;
  dealerName: string;
  type: "บริษัท" | "หจก." | "บุคคล" | "หน่วยงานรัฐ";
  province: string;
  dealsWon: number;
  totalRevenue: number;
  status: "active" | "inactive";
  lastContact: string;
  segment: "enterprise" | "sme" | "government";
};

export const hqAllCustomers: HQCustomer[] = [
  { id:1,  name:"บ.อุตสาหกรรมไทย จก.",        dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"บริษัท",        province:"ระยอง",       dealsWon:2, totalRevenue:7400000,  status:"active",   lastContact:"23 มิ.ย. 2026", segment:"enterprise" },
  { id:2,  name:"บ.เอบีซี แมนูแฟคเจอริ่ง",    dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"บริษัท",        province:"ชลบุรี",      dealsWon:1, totalRevenue:2800000,  status:"active",   lastContact:"18 มิ.ย. 2026", segment:"enterprise" },
  { id:3,  name:"หจก. ไอซ์โลจิสติกส์",         dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"หจก.",          province:"ระยอง",       dealsWon:3, totalRevenue:9200000,  status:"active",   lastContact:"10 มิ.ย. 2026", segment:"sme" },
  { id:4,  name:"บ.พีซีบี คอนสตรัคชั่น",       dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"บริษัท",        province:"ชลบุรี",      dealsWon:1, totalRevenue:3500000,  status:"active",   lastContact:"15 มิ.ย. 2026", segment:"sme" },
  { id:5,  name:"บ.ปิโตรเคม (ไทย)",            dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"บริษัท",        province:"ระยอง",       dealsWon:1, totalRevenue:5100000,  status:"active",   lastContact:"5 มิ.ย. 2026",  segment:"enterprise" },
  { id:6,  name:"สหกรณ์ลำพูน จก.",             dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", type:"หจก.",          province:"ลำพูน",       dealsWon:2, totalRevenue:3600000,  status:"active",   lastContact:"20 มิ.ย. 2026", segment:"sme" },
  { id:7,  name:"อบจ.เชียงใหม่",               dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", type:"หน่วยงานรัฐ",   province:"เชียงใหม่",   dealsWon:1, totalRevenue:4600000,  status:"active",   lastContact:"22 มิ.ย. 2026", segment:"government" },
  { id:8,  name:"บ.ซีเอ็นเอ็กซ์ ฟูด",         dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", type:"บริษัท",        province:"เชียงใหม่",   dealsWon:1, totalRevenue:3800000,  status:"active",   lastContact:"12 มิ.ย. 2026", segment:"sme" },
  { id:9,  name:"กลุ่มเกษตรลำพูน",             dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", type:"บุคคล",         province:"ลำพูน",       dealsWon:1, totalRevenue:2900000,  status:"inactive", lastContact:"2 มิ.ย. 2026",  segment:"sme" },
  { id:10, name:"บ.ทีดีเค ลอจิสติกส์",         dealerCode:"MST", dealerName:"สาขาแม่สอด",    type:"บริษัท",        province:"ตาก",         dealsWon:2, totalRevenue:8100000,  status:"active",   lastContact:"21 มิ.ย. 2026", segment:"enterprise" },
  { id:11, name:"หจก. แม่สอดพาณิชย์",          dealerCode:"MST", dealerName:"สาขาแม่สอด",    type:"หจก.",          province:"ตาก",         dealsWon:2, totalRevenue:4200000,  status:"active",   lastContact:"18 มิ.ย. 2026", segment:"sme" },
  { id:12, name:"บ.เฟรชโลจิส",                 dealerCode:"MST", dealerName:"สาขาแม่สอด",    type:"บริษัท",        province:"ตาก",         dealsWon:1, totalRevenue:3200000,  status:"active",   lastContact:"15 มิ.ย. 2026", segment:"sme" },
  { id:13, name:"วิสาหกิจชุมชนดอยอินทนนท์",   dealerCode:"CRI", dealerName:"สาขาเชียงราย",  type:"บุคคล",         province:"เชียงราย",    dealsWon:1, totalRevenue:3100000,  status:"active",   lastContact:"20 มิ.ย. 2026", segment:"sme" },
  { id:14, name:"บ.โกลเด้น ทรี โลจิส",         dealerCode:"CRI", dealerName:"สาขาเชียงราย",  type:"บริษัท",        province:"เชียงราย",    dealsWon:2, totalRevenue:4500000,  status:"active",   lastContact:"18 มิ.ย. 2026", segment:"sme" },
  { id:15, name:"ม.ราชภัฏเชียงราย",            dealerCode:"CRI", dealerName:"สาขาเชียงราย",  type:"หน่วยงานรัฐ",   province:"เชียงราย",    dealsWon:1, totalRevenue:4900000,  status:"inactive", lastContact:"5 มิ.ย. 2026",  segment:"government" },
  { id:16, name:"สหกรณ์การเกษตรนครสวรรค์",    dealerCode:"NSN", dealerName:"สาขานครสวรรค์", type:"หจก.",          province:"นครสวรรค์",   dealsWon:1, totalRevenue:1600000,  status:"active",   lastContact:"10 มิ.ย. 2026", segment:"sme" },
  { id:17, name:"เทศบาลเมืองนครสวรรค์",        dealerCode:"NSN", dealerName:"สาขานครสวรรค์", type:"หน่วยงานรัฐ",   province:"นครสวรรค์",   dealsWon:1, totalRevenue:900000,   status:"active",   lastContact:"24 มิ.ย. 2026", segment:"government" },
  { id:18, name:"บ.ระยองยานยนต์",              dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"บริษัท",        province:"ระยอง",       dealsWon:1, totalRevenue:3300000,  status:"active",   lastContact:"8 มิ.ย. 2026",  segment:"sme" },
  { id:19, name:"บ.ไทยสตีล",                   dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", type:"บริษัท",        province:"เชียงใหม่",   dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"25 มิ.ย. 2026", segment:"enterprise" },
  { id:20, name:"หจก. ราชบุรีโลหะ",            dealerCode:"RYG", dealerName:"สาขาระยอง",     type:"หจก.",          province:"ราชบุรี",     dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"24 มิ.ย. 2026", segment:"sme" },
];

// ─── HQ ALL QUOTATIONS ───────────────────────────────────────────────────────

export type HQQuotation = {
  id: string;
  quoteNo: string;
  dealerCode: string;
  dealerName: string;
  customer: string;
  valueNum: number;
  discountPct: number;
  status: "draft" | "sent" | "won" | "lost";
  createdAt: string;
  salesperson: string;
  productLine: string;
};

export const hqAllQuotations: HQQuotation[] = [
  { id:"HQ-Q01", quoteNo:"Q-2026-0089", dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", customer:"บ.ไทยสตีล",              valueNum:3200000, discountPct:15, status:"sent"          , createdAt:"24 มิ.ย. 2026", salesperson:"วิภา ป.",      productLine:"RANBUILD"  },
  { id:"HQ-Q02", quoteNo:"Q-2026-0091", dealerCode:"RYG", dealerName:"สาขาระยอง",     customer:"หจก. ราชบุรีโลหะ",       valueNum:1800000, discountPct:12, status:"sent"          , createdAt:"22 มิ.ย. 2026", salesperson:"สมชาย ว.",     productLine:"EASYBUILD" },
  { id:"HQ-Q03", quoteNo:"Q-2026-0085", dealerCode:"RYG", dealerName:"สาขาระยอง",     customer:"บ.อุตสาหกรรมไทย จก.",    valueNum:4200000, discountPct:5,  status:"won",              createdAt:"10 มิ.ย. 2026", salesperson:"สมชาย ว.",     productLine:"RANBUILD"  },
  { id:"HQ-Q04", quoteNo:"Q-2026-0086", dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", customer:"สหกรณ์ลำพูน จก.",        valueNum:2200000, discountPct:7,  status:"won",              createdAt:"8 มิ.ย. 2026",  salesperson:"วิภา ป.",      productLine:"EASYBUILD" },
  { id:"HQ-Q05", quoteNo:"Q-2026-0082", dealerCode:"MST", dealerName:"สาขาแม่สอด",    customer:"บ.ทีดีเค ลอจิสติกส์",    valueNum:5800000, discountPct:4,  status:"sent",             createdAt:"5 มิ.ย. 2026",  salesperson:"อนันต์ ส.",    productLine:"RANBUILD"  },
  { id:"HQ-Q06", quoteNo:"Q-2026-0080", dealerCode:"CRI", dealerName:"สาขาเชียงราย",  customer:"วิสาหกิจชุมชนดอยอินทนนท์",valueNum:3100000, discountPct:6,  status:"sent",             createdAt:"3 มิ.ย. 2026",  salesperson:"เกรียงไกร จ.", productLine:"CUSTOM"    },
  { id:"HQ-Q07", quoteNo:"Q-2026-0078", dealerCode:"NSN", dealerName:"สาขานครสวรรค์", customer:"สหกรณ์การเกษตรนครสวรรค์",valueNum:1600000, discountPct:3,  status:"won",              createdAt:"1 มิ.ย. 2026",  salesperson:"ธีรพล อ.",    productLine:"EASYBUILD" },
  { id:"HQ-Q08", quoteNo:"Q-2026-0077", dealerCode:"CRI", dealerName:"สาขาเชียงราย",  customer:"บ.โกลเด้น ทรี โลจิส",    valueNum:2400000, discountPct:8,  status:"won",              createdAt:"28 พ.ค. 2026",  salesperson:"เกรียงไกร จ.", productLine:"RANBUILD"  },
  { id:"HQ-Q09", quoteNo:"Q-2026-0075", dealerCode:"RYG", dealerName:"สาขาระยอง",     customer:"บ.ปิโตรเคม (ไทย)",       valueNum:5100000, discountPct:5,  status:"won",              createdAt:"25 พ.ค. 2026",  salesperson:"สมชาย ว.",     productLine:"RANBUILD"  },
  { id:"HQ-Q10", quoteNo:"Q-2026-0073", dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", customer:"บ.ซีเอ็นเอ็กซ์ ฟูด",    valueNum:3800000, discountPct:6,  status:"sent",             createdAt:"20 พ.ค. 2026",  salesperson:"สุรชัย ท.",    productLine:"RANBUILD"  },
  { id:"HQ-Q11", quoteNo:"Q-2026-0070", dealerCode:"MST", dealerName:"สาขาแม่สอด",    customer:"หจก. แม่สอดพาณิชย์",    valueNum:2100000, discountPct:5,  status:"won",              createdAt:"15 พ.ค. 2026",  salesperson:"อนันต์ ส.",    productLine:"CUSTOM"    },
  { id:"HQ-Q12", quoteNo:"Q-2026-0068", dealerCode:"HYI", dealerName:"สาขาหาดใหญ่",  customer:"บ.หาดใหญ่อุตสาหกรรม",   valueNum:480000,  discountPct:0,  status:"draft",            createdAt:"10 พ.ค. 2026",  salesperson:"พิมพ์ ท.",     productLine:"CUSTOM"    },
  { id:"HQ-Q13", quoteNo:"Q-2026-0065", dealerCode:"NSN", dealerName:"สาขานครสวรรค์", customer:"เทศบาลเมืองนครสวรรค์",  valueNum:900000,  discountPct:0,  status:"sent",             createdAt:"5 พ.ค. 2026",   salesperson:"ธีรพล อ.",    productLine:"PREFAB"    },
  { id:"HQ-Q14", quoteNo:"Q-2026-0062", dealerCode:"RYG", dealerName:"สาขาระยอง",     customer:"บ.เอสทีพี โฮลดิ้ง",     valueNum:1900000, discountPct:4,  status:"won",              createdAt:"1 พ.ค. 2026",   salesperson:"ประภาส ร.",    productLine:"PREFAB"    },
  { id:"HQ-Q15", quoteNo:"Q-2026-0058", dealerCode:"CNX", dealerName:"สาขาเชียงใหม่", customer:"กลุ่มเกษตรลำพูน",       valueNum:2900000, discountPct:9,  status:"lost",             createdAt:"20 เม.ย. 2026", salesperson:"วิภา ป.",      productLine:"CUSTOM"    },
  { id:"HQ-Q16", quoteNo:"Q-2026-0055", dealerCode:"CRI", dealerName:"สาขาเชียงราย",  customer:"ม.ราชภัฏเชียงราย",       valueNum:4900000, discountPct:7,  status:"draft",            createdAt:"15 เม.ย. 2026", salesperson:"สุชาติ ม.",    productLine:"CUSTOM"    },
  { id:"HQ-Q17", quoteNo:"Q-2026-0092", dealerCode:"RYG", dealerName:"สาขาระยอง",     customer:"บ.ระยองยานยนต์",         valueNum:3300000, discountPct:6,  status:"sent",             createdAt:"25 มิ.ย. 2026", salesperson:"สมชาย ว.",     productLine:"CUSTOM"    },
];

// ─── HQ ANNOUNCEMENTS ────────────────────────────────────────────────────────

export type AnnouncementCategory = "ราคา" | "โปรโมชั่น" | "นโยบาย" | "ทั่วไป";

export type HQAnnouncement = {
  id: number;
  title: string;
  body: string;
  category: AnnouncementCategory;
  publishedAt: string;
  author: string;
  targetBranches: "all" | string[];
  pinned: boolean;
};

export const hqAnnouncements: HQAnnouncement[] = [
  {
    id: 1,
    title: "ปรับราคากลาง RANBUILD และ EASYBUILD มีผล 1 ก.ค. 2026",
    body: "แจ้งให้ทุกสาขาทราบ ราคากลางผลิตภัณฑ์ RANBUILD ปรับขึ้น 3.5% และ EASYBUILD ปรับขึ้น 2.8% มีผลตั้งแต่ 1 กรกฎาคม 2569 เป็นต้นไป ใบเสนอราคาที่ออกก่อนวันดังกล่าวยังคงใช้ราคาเดิมได้ไม่เกิน 30 วัน กรุณาอัปเดตระบบก่อนออกใบเสนอราคาใหม่",
    category: "ราคา",
    publishedAt: "25 มิ.ย. 2026",
    author: "วิชัย ประสิทธิ์ (GM)",
    targetBranches: "all",
    pinned: true,
  },
  {
    id: 2,
    title: "โปรโมชั่น Q3/2026 — ส่วนลดพิเศษโอกาสการขาย SME < 3M",
    body: "เพื่อกระตุ้นยอดขาย Q3 HQ อนุมัติส่วนลดพิเศษสำหรับโอกาสการขาย SME มูลค่าต่ำกว่า 3 ล้านบาท สามารถให้ส่วนลดได้สูงสุด 12% โดยไม่ต้องผ่านกระบวนการอนุมัติ มีผลระหว่าง 1 กรกฎาคม ถึง 30 กันยายน 2569 เท่านั้น",
    category: "โปรโมชั่น",
    publishedAt: "24 มิ.ย. 2026",
    author: "ฝ่ายการตลาด",
    targetBranches: "all",
    pinned: true,
  },
  {
    id: 3,
    title: "นโยบายใหม่: การขอยกเว้นส่วนลดต้องแนบ BOQ ทุกครั้ง",
    body: "ตั้งแต่วันที่ 1 กรกฎาคม 2569 การขอส่วนลดเกินเกณฑ์ทุกรายการต้องแนบ BOQ (Bill of Quantities) ประกอบด้วย หากการยื่นไม่มี BOQ ระบบจะปฏิเสธอัตโนมัติ กรุณาแจ้งทีมขายในสาขาให้รับทราบ",
    category: "นโยบาย",
    publishedAt: "20 มิ.ย. 2026",
    author: "วิชัย ประสิทธิ์ (GM)",
    targetBranches: "all",
    pinned: false,
  },
  {
    id: 4,
    title: "ประชุมทบทวนยอดขายประจำไตรมาส 2 — 30 มิ.ย. 2026 เวลา 13:00 น.",
    body: "ขอเชิญผู้จัดการสาขาทุกท่านเข้าร่วมประชุมทบทวนยอดขายประจำไตรมาส 2/2569 ผ่าน Zoom วันจันทร์ที่ 30 มิถุนายน เวลา 13:00–15:00 น. กรุณาเตรียมตัวเลขยอดขาย โอกาสการขาย และปัญหาที่ต้องการสนับสนุนจาก HQ",
    category: "ทั่วไป",
    publishedAt: "18 มิ.ย. 2026",
    author: "ฝ่ายขาย",
    targetBranches: "all",
    pinned: false,
  },
  {
    id: 5,
    title: "สาขาเหนือ: สนับสนุนงบการตลาดร่วมไตรมาส 3 สูงสุด 50,000 บาท",
    body: "HQ อนุมัติงบสนับสนุนการตลาดร่วมสำหรับสาขาภาคเหนือ (CNX, CRI, MST) มูลค่าสูงสุดสาขาละ 50,000 บาทสำหรับไตรมาส 3/2569 สามารถใช้งบนี้ในกิจกรรม นิทรรศการ โฆษณาท้องถิ่น หรือวันจัดแสดงสินค้า กรุณายื่นแผนงานกลับมาภายใน 5 กรกฎาคม",
    category: "โปรโมชั่น",
    publishedAt: "15 มิ.ย. 2026",
    author: "ฝ่ายการตลาด",
    targetBranches: ["CNX", "CRI", "MST"],
    pinned: false,
  },
  {
    id: 6,
    title: "อัปเดตเอกสาร: แม่แบบ สัญญาซื้อขายฉบับใหม่ 2026",
    body: "ฝ่ายกฎหมายได้อัปเดต แม่แบบ สัญญาซื้อขายให้สอดคล้องกับ พ.ร.บ. คุ้มครองผู้บริโภค ฉบับปรับปรุง กรุณาใช้ แม่แบบ ใหม่สำหรับสัญญาที่ลงนามตั้งแต่เดือนกรกฎาคม 2569 เป็นต้นไป แม่แบบ พร้อมดาวน์โหลดในระบบคลังเอกสาร",
    category: "นโยบาย",
    publishedAt: "10 มิ.ย. 2026",
    author: "ฝ่ายกฎหมาย",
    targetBranches: "all",
    pinned: false,
  },
  {
    id: 7,
    title: "ผลการประเมิน KPI สาขา Q1/2026 — สรุป",
    body: "ผลการประเมิน KPI ไตรมาส 1/2569: สาขาระยองและเชียงใหม่ทำได้เกินเป้า ได้รับโบนัสตามเกณฑ์ สาขาเชียงรายและหาดใหญ่ต่ำกว่าเป้า HQ จะนัดประชุมตัวต่อตัวเพื่อวางแผนแก้ไขในสัปดาห์หน้า",
    category: "ทั่วไป",
    publishedAt: "5 มิ.ย. 2026",
    author: "วิชัย ประสิทธิ์ (GM)",
    targetBranches: "all",
    pinned: false,
  },
];


// ─── DEALER PIPELINE (ported from pms-benjamin) ───────────────────────────────
export type PipelineOutcome = "active" | "won" | "lost";
export type PipelineTask = { id: number; text: string; done: boolean };
export type PipelineFile = { name: string; size: string };

export type DealActivityType =
  | "deal_created" | "stage_change" | "task_done" | "task_undone"
  | "note_added"   | "file_added"   | "won"        | "lost";

export type DealActivity = {
  id: number;
  type: DealActivityType;
  text: string;
  timestamp: string;
};

export type PipelineDealMock = {
  id: number;
  customerId: number;
  customer: string;
  project: string;
  value: number;
  stageId: number;
  assigned: string;
  dealer: string;
  dealerColor: string;
  tasks: PipelineTask[];
  files: PipelineFile[];
  outcome: PipelineOutcome;
  createdAt: string;
  expectedClose?: string;   // วันคาดว่าจะปิดการขาย (Expected Closing Date)
  lostReason?: string;
  notes?: string;
  activities?: DealActivity[];
};

// ─── Unified Sales Pipeline Statuses ──────────────────────────────
export const PIPELINE_STATUSES = {
  new_lead:    "ลีดใหม่",
  contacted:   "ติดต่อแล้ว",
  meeting:     "นัดประชุม",
  quotation:   "เสนอราคา",
  negotiation: "เจรจา",
  won:         "ปิดการขายสำเร็จ",
  lost:        "ปิดการขายไม่สำเร็จ",
} as const;

export const PIPELINE_STAGE_PROGRESS: Record<number, number> = {
  1: 5, 2: 20, 4: 45, 5: 65, 6: 85, 7: 100, 8: 0,
};

export type DealStage = { id: number; name: string; color: string };

export const pipelineStages: DealStage[] = [
  { id: 1, name: "ผู้สนใจใหม่",          color: "#6b7280" },
  { id: 2, name: "ติดต่อแล้ว",           color: "#003366" },
  { id: 4, name: "รวบรวมความต้องการ",   color: "#2D2D2D" },
  { id: 5, name: "เสนอราคา",            color: "#f59e0b" },
  { id: 9, name: "ติดตามผล",            color: "#d97706" },
  { id: 6, name: "เจรจาต่อรอง",         color: "#002244" },
  { id: 7, name: "ปิดการขาย",           color: "#059669" },
  { id: 8, name: "ไม่ได้งาน",           color: "#dc2626" },
];

export const pipelineDeals: PipelineDealMock[] = [
  // ── สาขาเชียงใหม่ ──
  {
    id: 1, customerId: 3, customer: "หจก. ราชบุรีโลหะ", project: "โกดังสำเร็จรูป ราชบุรี",
    value: 760000, stageId: 2, assigned: "วิภา", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-06-20",
    notes: "ลูกค้าสนใจระบบอาคารสำเร็จรูป สำหรับโกดังขนาด 1,200 ตร.ม. ต้องการส่งของให้เร็วที่สุด",
    files: [],
    tasks: [
      { id: 1, text: "โทรหาลูกค้าครั้งแรก",    done: true  },
      { id: 2, text: "ส่งแคตตาล็อกสินค้า",  done: true  },
      { id: 3, text: "นัดประชุมออนไลน์",        done: false },
    ],
    activities: [
      { id: 1, type: "deal_created",  text: "สร้างโอกาสการขายใหม่", timestamp: "2026-06-20T09:00:00" },
      { id: 2, type: "task_done",     text: "เสร็จงาน: โทรหาลูกค้าครั้งแรก", timestamp: "2026-06-20T10:30:00" },
      { id: 3, type: "task_done",     text: "เสร็จงาน: ส่งแคตตาล็อกสินค้า", timestamp: "2026-06-21T11:00:00" },
      { id: 4, type: "stage_change",  text: "ย้ายขั้นตอน → ติดต่อแล้ว", timestamp: "2026-06-21T11:05:00" },
    ],
  },
  {
    id: 2, customerId: 7, customer: "บจ. อุตรดิตถ์โลหะ", project: "อาคารสำเร็จรูป อุตรดิตถ์",
    value: 2800000, stageId: 4, assigned: "วิภา", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-06-15",
    files: [{ name: "presentation.pdf", size: "2.1MB" }],
    tasks: [
      { id: 4, text: "นำเสนอโซลูชัน",  done: true  },
      { id: 5, text: "ส่งตัวอย่างผลิตภัณฑ์", done: true  },
      { id: 6, text: "เยี่ยมชมสถานที่",  done: false },
      { id: 7, text: "สรุปความต้องการ", done: false },
    ],
  },
  {
    id: 3, customerId: 6, customer: "บจ. แม่สอดโลหะ", project: "อาคารสำเร็จรูป แม่สอด",
    value: 4100000, stageId: 4, assigned: "สมชาย", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-06-10",
    files: [],
    tasks: [
      { id: 8,  text: "นำเสนอโซลูชัน",              done: true },
      { id: 9,  text: "สำรวจความต้องการลูกค้า",        done: true },
      { id: 10, text: "จัดทำ BOQ ประกอบการเสนอราคา",  done: true },
    ],
  },
  {
    id: 4, customerId: 2, customer: "บจ. ซีซีเอส", project: "อาคารสำเร็จรูป บจ. ซีซีเอส เชียงใหม่",
    value: 3200000, stageId: 5, assigned: "กาญจนา", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-05-28",
    notes: "ลูกค้าต้องการอาคารสำเร็จรูป 3 หลัง แต่ละหลัง 800 ตร.ม. ขอส่วนลดสั่งซื้อจำนวนมาก 5%",
    files: [{ name: "quotation_Q2026-0095.pdf", size: "1.4MB" }, { name: "specs.xlsx", size: "340KB" }],
    tasks: [
      { id: 11, text: "จัดทำใบเสนอราคา",        done: true  },
      { id: 12, text: "ส่งใบเสนอราคาให้ลูกค้า", done: true  },
      { id: 13, text: "ติดตามผล",               done: false },
      { id: 14, text: "อธิบาย spec เพิ่มเติม",  done: false },
    ],
    activities: [
      { id: 10, type: "deal_created",  text: "สร้างโอกาสการขายใหม่", timestamp: "2026-05-28T08:30:00" },
      { id: 11, type: "stage_change",  text: "ย้ายขั้นตอน → นัดประชุม", timestamp: "2026-06-01T14:00:00" },
      { id: 12, type: "task_done",     text: "เสร็จงาน: จัดทำใบเสนอราคา", timestamp: "2026-06-10T16:00:00" },
      { id: 13, type: "file_added",    text: "อัปโหลดไฟล์: quotation_Q2026-0095.pdf", timestamp: "2026-06-10T16:05:00" },
      { id: 14, type: "stage_change",  text: "ย้ายขั้นตอน → เสนอราคา", timestamp: "2026-06-11T09:00:00" },
      { id: 15, type: "task_done",     text: "เสร็จงาน: ส่งใบเสนอราคาให้ลูกค้า", timestamp: "2026-06-11T09:30:00" },
    ],
  },
  {
    id: 5, customerId: 4, customer: "บจ. สมุทรโกดัง", project: "อาคารสำเร็จรูป ปากน้ำ",
    value: 2000000, stageId: 6, assigned: "สมชาย", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-05-20",
    files: [{ name: "contract_draft.docx", size: "520KB" }],
    tasks: [
      { id: 15, text: "เจรจาเงื่อนไขราคา", done: true  },
      { id: 16, text: "ปรับแก้สัญญา",      done: true  },
      { id: 17, text: "นัดเซ็นสัญญา",      done: false },
    ],
  },
  {
    id: 6, customerId: 1, customer: "บจ. ไทยสตีล", project: "อาคารสำเร็จรูป บจ. ไทยสตีล",
    value: 1800000, stageId: 6, assigned: "วิชัย", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "active", createdAt: "2026-05-01",
    files: [{ name: "signed_contract.pdf", size: "1.8MB" }],
    tasks: [
      { id: 18, text: "ลูกค้าอนุมัติในหลักการ", done: true },
      { id: 19, text: "เตรียมเอกสารสัญญา",      done: true },
      { id: 20, text: "เซ็นสัญญาสำเร็จ",        done: true },
    ],
  },
  {
    id: 7, customerId: 5, customer: "VCS Asia Co., Ltd.", project: "โกดังสำเร็จรูป ระยอง VCS Asia",
    value: 6200000, stageId: 7, assigned: "วิชัย", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "won", createdAt: "2025-11-10", files: [], tasks: [],
  },
  {
    id: 8, customerId: 8, customer: "บจ. นครสวรรค์โลหะ", project: "โรงงานสำเร็จรูป นครสวรรค์",
    value: 5400000, stageId: 7, assigned: "สมชาย", dealer: "สาขาเชียงใหม่", dealerColor: "#003366",
    outcome: "won", createdAt: "2026-04-05", files: [], tasks: [],
  },
  // ── สาขานนทบุรี ──
  {
    id: 9, customerId: 1, customer: "บจ. ไทยสตีล", project: "อาคารสำเร็จรูป เฟส 2 นนทบุรี",
    value: 3500000, stageId: 2, assigned: "ปรีดา", dealer: "สาขานนทบุรี", dealerColor: "#f59e0b",
    outcome: "active", createdAt: "2026-06-18",
    files: [],
    tasks: [
      { id: 30, text: "ส่งเอกสารข้อเสนอ",  done: true  },
      { id: 31, text: "นัดประชุมลูกค้า",       done: false },
    ],
  },
  {
    id: 10, customerId: 2, customer: "บจ. ซีซีเอส", project: "อาคารสำเร็จรูป นนทบุรี",
    value: 5800000, stageId: 5, assigned: "สายชล", dealer: "สาขานนทบุรี", dealerColor: "#f59e0b",
    outcome: "active", createdAt: "2026-05-15",
    files: [{ name: "BOQ_NTB.xlsx", size: "512KB" }, { name: "quote_v2.pdf", size: "1.1MB" }],
    tasks: [
      { id: 32, text: "จัดทำ BOQ ละเอียด",    done: true  },
      { id: 33, text: "ส่งใบเสนอราคา",        done: true  },
      { id: 34, text: "นำเสนอต่อ MD",         done: false },
      { id: 35, text: "ขอ final approval",     done: false },
    ],
  },
  {
    id: 11, customerId: 5, customer: "VCS Asia Co., Ltd.", project: "คลังสินค้า นนทบุรี",
    value: 9200000, stageId: 6, assigned: "ปรีดา", dealer: "สาขานนทบุรี", dealerColor: "#f59e0b",
    outcome: "active", createdAt: "2026-04-20",
    files: [{ name: "contract_VCS_NTB.pdf", size: "2.3MB" }],
    tasks: [
      { id: 36, text: "เจรจาเงื่อนไข",        done: true },
      { id: 37, text: "ปรับ scope งาน",        done: true },
      { id: 38, text: "เซ็นสัญญา",            done: false },
    ],
  },
  // ── สาขาระยอง ──
  {
    id: 12, customerId: 4, customer: "บจ. สมุทรโกดัง", project: "อาคารสำเร็จรูป ระยองตะวันออก",
    value: 4400000, stageId: 4, assigned: "มานิตย์", dealer: "สาขาระยอง", dealerColor: "#22c55e",
    outcome: "active", createdAt: "2026-06-08",
    files: [{ name: "layout_Rayong.dwg", size: "6.1MB" }],
    tasks: [
      { id: 40, text: "นำเสนอโซลูชัน",             done: true  },
      { id: 41, text: "เยี่ยมชมสถานที่ลูกค้า",        done: true  },
      { id: 42, text: "สรุปความต้องการและข้อกำหนด",   done: false },
    ],
  },
  {
    id: 13, customerId: 3, customer: "หจก. ราชบุรีโลหะ", project: "คลังสินค้าเขต EEC",
    value: 7100000, stageId: 7, assigned: "มานิตย์", dealer: "สาขาระยอง", dealerColor: "#22c55e",
    outcome: "won", createdAt: "2026-03-10",
    files: [{ name: "signed_eec.pdf", size: "1.9MB" }],
    tasks: [
      { id: 43, text: "เซ็นสัญญา", done: true },
      { id: 44, text: "รับมัดจำ",  done: true },
    ],
  },
];



// ─── SALES TEMPLATES ─────────────────────────────────────────────────────────
export type TemplateTaskCategory = "lead" | "requirement" | "quotation" | "followup";

export type TemplateTask = {
  id: number;
  text: string;
  category: TemplateTaskCategory;
};

export type SalesTemplateMock = {
  id: number;
  name: string;
  description: string;
  dealerCompany: string;
  tasks: TemplateTask[];
  fileTypes: string[];
  isDefault: boolean;
  createdAt: string;
};

export const TEMPLATE_TASK_CATEGORY_LABEL: Record<TemplateTaskCategory, string> = {
  lead:        "รับลีด",
  requirement: "รวบรวมข้อมูล",
  quotation:   "ใบเสนอราคา",
  followup:    "ติดตามผล",
};

export const TEMPLATE_TASK_CATEGORY_COLOR: Record<TemplateTaskCategory, { bg: string; text: string }> = {
  lead:        { bg: "#dce5f0", text: "#003366" },
  requirement: { bg: "#fef3cd", text: "#d97706" },
  quotation:   { bg: "#dce5f0", text: "#003366" },
  followup:    { bg: "#f0fdf4", text: "#15803d" },
};

export const salesTemplates: SalesTemplateMock[] = [
  {
    id: 1,
    name: "คลังสินค้า / โกดัง",
    description: "สำหรับลูกค้าที่ต้องการโกดังสินค้าหรือคลังเก็บของ ขนาดเล็กถึงกลาง",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: true,
    createdAt: "2026-01-15",
    tasks: [
      { id: 1,  text: "ติดต่อลูกค้าและนัดสำรวจพื้นที่",                          category: "lead" },
      { id: 2,  text: "รวบรวมข้อมูลขนาด ความสูง และประเภทสินค้าที่จัดเก็บ",      category: "requirement" },
      { id: 3,  text: "ส่งแค็ตตาล็อกโกดังสำเร็จรูปและตัวอย่างงานที่ผ่านมา",     category: "requirement" },
      { id: 4,  text: "จัดทำ BOQ และประมาณราคาเบื้องต้น",                         category: "quotation" },
      { id: 5,  text: "นำเสนอใบเสนอราคาอย่างเป็นทางการ",                          category: "quotation" },
      { id: 6,  text: "ติดตามผลและเจรจาต่อรองเงื่อนไข",                           category: "followup" },
      { id: 7,  text: "ปิดการขาย / ลงนามสัญญา",                                   category: "followup" },
    ],
    fileTypes: ["แบบแปลนเบื้องต้น", "ภาพถ่ายพื้นที่", "เอกสารยืนยันความต้องการ", "BOQ เบื้องต้น"],
  },
  {
    id: 2,
    name: "อาคารอุตสาหกรรม / โรงงาน",
    description: "สำหรับลูกค้าที่ต้องการโรงงานผลิต อาคาร PEB หรืออาคารอุตสาหกรรมขนาดกลาง-ใหญ่",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: false,
    createdAt: "2026-01-20",
    tasks: [
      { id: 1,  text: "ติดต่อลูกค้าและนัดสำรวจโรงงาน",                                 category: "lead" },
      { id: 2,  text: "รวบรวมสเปกเครื่องจักร โหลดพิเศษ และผังพื้นที่การใช้งาน",      category: "requirement" },
      { id: 3,  text: "เลือกรุ่น PEB ที่เหมาะสมกับการใช้งานของลูกค้า",              category: "requirement" },
      { id: 4,  text: "จัดทำแบบนำเสนอเบื้องต้นและประมาณการราคา",                  category: "requirement" },
      { id: 5,  text: "คำนวณราคาและจัดทำใบเสนอราคาเบื้องต้น",                           category: "quotation" },
      { id: 6,  text: "นำเสนอใบเสนอราคาพร้อมภาพจำลอง 3D",                         category: "quotation" },
      { id: 7,  text: "ติดตามผลและปรับแก้ข้อกำหนดทางเทคนิค",                           category: "followup" },
      { id: 8,  text: "ปิดการขาย / ลงนามสัญญา",                                        category: "followup" },
    ],
    fileTypes: ["แบบแปลนเบื้องต้น", "ภาพถ่ายพื้นที่", "เอกสารยืนยันความต้องการ", "BOQ เบื้องต้น"],
  },
  {
    id: 3,
    name: "อาคารเชิงพาณิชย์",
    description: "สำหรับอาคารพาณิชย์ ร้านค้า ศูนย์บริการ หรืออาคารสำนักงาน",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: false,
    createdAt: "2026-02-01",
    tasks: [
      { id: 1,  text: "ติดต่อลูกค้าและสำรวจความต้องการเชิงธุรกิจ",               category: "lead" },
      { id: 2,  text: "ประเมินการจราจรและการแบ่งโซนของพื้นที่",          category: "requirement" },
      { id: 3,  text: "เสนอแนวคิดการออกแบบและรูปลักษณ์ภายนอก",                 category: "requirement" },
      { id: 4,  text: "จัดทำแบบและ BOQ เบื้องต้น",                               category: "quotation" },
      { id: 5,  text: "นำเสนอใบเสนอราคา",                                        category: "quotation" },
      { id: 6,  text: "ติดตามผลและปรับแก้ตามความต้องการลูกค้า",                 category: "followup" },
      { id: 7,  text: "ปิดการขาย / ลงนามสัญญา",                                 category: "followup" },
    ],
    fileTypes: ["แบบแปลนเบื้องต้น", "ภาพถ่ายพื้นที่", "เอกสารยืนยันความต้องการ", "BOQ เบื้องต้น"],
  },
  {
    id: 4,
    name: "อาคารสำเร็จรูป",
    description: "สำหรับลูกค้าที่ต้องการอาคารสำเร็จรูป Benjamin เลือกรุ่นได้จากแค็ตตาล็อก",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: false,
    createdAt: "2026-02-10",
    tasks: [
      { id: 1,  text: "ส่งแค็ตตาล็อกรุ่นสำเร็จรูป Benjamin ที่เหมาะสม",     category: "lead" },
      { id: 2,  text: "เลือกรุ่น ขนาด และตัวเลือกเสริม (ประตู/หน้าต่าง/สี)",  category: "requirement" },
      { id: 3,  text: "ตรวจสอบสถานที่และระบบสาธารณูปโภค",                      category: "requirement" },
      { id: 4,  text: "จัดทำใบเสนอราคาพร้อมรายละเอียดรุ่น",                  category: "quotation" },
      { id: 5,  text: "ยืนยันระยะเวลาและเงื่อนไขในใบเสนอราคา",            category: "quotation" },
      { id: 6,  text: "ปิดการขาย / ลงนามสัญญา",                               category: "followup" },
    ],
    fileTypes: ["เอกสารยืนยันความต้องการ", "ภาพถ่ายพื้นที่", "BOQ เบื้องต้น"],
  },
  {
    id: 5,
    name: "อาคารเกษตร",
    description: "สำหรับโรงเพาะ โรงเก็บผลผลิต อาคารฟาร์ม หรืองานเกษตรอุตสาหกรรม",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: false,
    createdAt: "2026-03-01",
    tasks: [
      { id: 1,  text: "ติดต่อลูกค้าและสำรวจพื้นที่เกษตร",                             category: "lead" },
      { id: 2,  text: "ประเมินความต้องการ (โรงเพาะ/เก็บผลผลิต/อาคารฟาร์ม)",         category: "requirement" },
      { id: 3,  text: "ออกแบบให้เหมาะกับสภาพอากาศและภูมิประเทศพื้นที่",             category: "requirement" },
      { id: 4,  text: "จัดทำ BOQ และประมาณราคา",                                      category: "quotation" },
      { id: 5,  text: "นำเสนอใบเสนอราคา",                                             category: "quotation" },
      { id: 6,  text: "ปิดการขาย / ลงนามสัญญา",                                      category: "followup" },
    ],
    fileTypes: ["แบบแปลนเบื้องต้น", "ภาพถ่ายพื้นที่", "เอกสารยืนยันความต้องการ"],
  },
  {
    id: 6,
    name: "งานพิเศษ / Custom",
    description: "สำหรับโอกาสการขายที่ไม่อยู่ในหมวดหมู่มาตรฐาน ต้องการออกแบบเฉพาะ",
    dealerCompany: "สาขาเชียงใหม่",
    isDefault: false,
    createdAt: "2026-03-10",
    tasks: [
      { id: 1,  text: "รับโจทย์งานพิเศษจากลูกค้าอย่างละเอียด",               category: "lead" },
      { id: 2,  text: "ประเมินความเป็นไปได้ทางเทคนิคและงบประมาณ",              category: "requirement" },
      { id: 3,  text: "ออกแบบแนวคิดพิเศษและประเมินความต้องการ",              category: "requirement" },
      { id: 4,  text: "จัดทำใบเสนอราคาเฉพาะงาน",                             category: "quotation" },
      { id: 5,  text: "คำนวณราคาและจัดทำใบเสนอราคาเฉพาะงาน",               category: "quotation" },
      { id: 6,  text: "ติดตามผล เจรจา และปรับแก้เงื่อนไข",                       category: "followup" },
      { id: 7,  text: "ปิดการขาย / ลงนามสัญญา",                                  category: "followup" },
    ],
    fileTypes: ["แบบแปลนเบื้องต้น", "เอกสารยืนยันความต้องการ", "ภาพถ่ายพื้นที่", "BOQ เบื้องต้น"],
  },
];

// ─── DEALER NOTES (ported from pms-benjamin) ──────────────────────────────────
export type NoteCategory = "ลูกค้า" | "โอกาสการขาย" | "ประชุม" | "ทั่วไป";
export type NoteMock = {
  id: number; title: string; content: string;
  category: NoteCategory; pinned: boolean;
  customerId?: number; customerName?: string;
  author: string; createdAt: string; updatedAt: string;
  color: string;
};

export const noteCategoryColor: Record<NoteCategory, { bg: string; text: string; dot: string }> = {
  ลูกค้า:  { bg: "#dce5f0", text: "#003366", dot: "#003366" },
  โอกาสการขาย: { bg: "#fef3cd", text: "#b45309", dot: "#f59e0b" },
  ประชุม:  { bg: "#f0fdf4", text: "#15803d", dot: "#059669" },
  ทั่วไป:  { bg: "#f0f0f5", text: "#6b7280", dot: "#9ca3af" },
};

export const notes: NoteMock[] = [
  {
    id: 1, title: "สรุปการโทรหา บจ. ไทยสตีล", category: "ลูกค้า", pinned: true,
    content: "โทรคุยกับคุณสมชาย เรื่องความคืบหน้าการขายโอกาสการขายโกดัง\n- ลูกค้าพอใจกับความคืบหน้า 65%\n- ขอให้ส่งรายงานรายสัปดาห์\n- จะนัดติดตามโอกาสการขายวันที่ 5 ก.ค. 2569",
    customerId: 1, customerName: "บจ. ไทยสตีล",
    author: "สมชาย", createdAt: "2026-06-20 14:30", updatedAt: "2026-06-20 14:30", color: "#003366",
  },
  {
    id: 2, title: "ประชุมทีมขาย ประจำสัปดาห์", category: "ประชุม", pinned: true,
    content: "ประชุมวันจันทร์ที่ 23 มิ.ย. 2569\n\nสรุปประเด็น:\n1. โอกาสการขายรวม ฿14.6M (กำลังดำเนินการ 6 รายการ)\n2. เป้าหมาย Q2 ต้องปิด 2 deals เพิ่ม\n3. ลีดใหม่จาก นิคมฯ อมตะ 3 ราย\n\nAction items:\n- วิภา: follow up บจ. อุตรดิตถ์โลหะ ภายใน 3 วัน\n- วิชัย: นำเสนอ spec ให้ VCS Asia รอบ 2",
    author: "กาญจนา", createdAt: "2026-06-23 10:00", updatedAt: "2026-06-23 10:45", color: "#15803d",
  },
  {
    id: 3, title: "ข้อเสนอพิเศษ บจ. ซีซีเอส", category: "โอกาสการขาย", pinned: false,
    content: "ลูกค้าขอส่วนลดเพิ่ม 5% สำหรับโอกาสการขาย PREFAB เชียงใหม่\n\nพิจารณา:\n- มูลค่าโอกาสการขาย ฿3.2M\n- ส่วนลด 5% = ฿160,000\n- อัตรากำไรยังคุ้มอยู่ถ้าได้ออเดอร์ครั้งถัดไป\n\nตัดสินใจ: อนุมัติส่วนลด 3% เป็นพิเศษ รอยืนยัน",
    customerId: 2, customerName: "บจ. ซีซีเอส",
    author: "กาญจนา", createdAt: "2026-06-18 16:00", updatedAt: "2026-06-19 09:00", color: "#b45309",
  },
  {
    id: 4, title: "ติดต่อ Mr. Kevin Lim (VCS Asia)", category: "ลูกค้า", pinned: false,
    content: "อีเมลถึง Kevin เรื่องโอกาสการขายระยอง เฟส 2\n- Kevin สนใจขยายโกดังอีก 2,000 ตร.ม.\n- งบประมาณ ฿8-10M\n- ต้องการใบเสนอราคาภายใน 2 สัปดาห์\n\nขั้นถัดไป: ส่ง BOQ เบื้องต้นภายใน 27 มิ.ย.",
    customerId: 5, customerName: "VCS Asia Co., Ltd.",
    author: "วิชัย", createdAt: "2026-06-22 11:15", updatedAt: "2026-06-22 11:15", color: "#003366",
  },
  {
    id: 5, title: "รายการตรวจปิดการขาย RANBUILD", category: "ทั่วไป", pinned: false,
    content: "สิ่งที่ต้องทำก่อนปิดการขาย RANBUILD นครสวรรค์:\n\n☑ ยืนยันรายละเอียดใบเสนอราคาครบ\n☑ ตรวจสอบเงื่อนไขการชำระเงิน\n☑ ส่งเอกสารสัญญาให้ลูกค้า\n☑ ทบทวนเงื่อนไขร่วมกับลูกค้า\n☐ รับเงินงวดสุดท้าย\n☐ ออกใบรับประกัน",
    author: "สมชาย", createdAt: "2026-06-15 08:00", updatedAt: "2026-06-21 13:00", color: "#6b7280",
  },
  {
    id: 6, title: "ติดตาม หจก. ราชบุรีโลหะ", category: "โอกาสการขาย", pinned: false,
    content: "โอกาสการขายโกดังสำเร็จรูป ราชบุรี 760K\nลูกค้ายังลังเลเรื่องราคา เปรียบเทียบกับคู่แข่ง\n\nจุดแข็งที่ต้องเน้น:\n- Benjamin มาตรฐาน ISO\n- รับประกัน 5 ปี\n- ส่งได้เร็วกว่า (8 สัปดาห์)\n\nวางแผนโทรติดตามอีกครั้ง 25 มิ.ย.",
    customerId: 3, customerName: "หจก. ราชบุรีโลหะ",
    author: "วิภา", createdAt: "2026-06-17 09:30", updatedAt: "2026-06-17 09:30", color: "#b45309",
  },
];
