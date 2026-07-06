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
    dealerName: "เชียงใหม่สตีลบิลด์",
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
  avatar?: string; // รูปโปรไฟล์ (data URL) — ไม่บังคับ, ถ้าไม่มีใช้อักษรย่อ
};

// โหลดรายชื่อผู้รับผิดชอบจาก localStorage (ที่ตั้งค่าในหน้า Settings) — fallback = mock
// ใช้โดย PersonPicker เพื่อให้ตัวเลือกมีรูป+ชื่อ ตรงกับที่บันทึกไว้
export function loadResponsiblePersons(): ResponsiblePerson[] {
  if (typeof window === "undefined") return responsiblePersons;
  try {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) return arr.map((p, i) => ({ ...p, id: i + 1 }));
    }
  } catch {}
  return responsiblePersons;
}

export const responsiblePersons: ResponsiblePerson[] = [
  { id: 1, name: "สมชาย เชียงใหม่", title: "ผู้จัดการฝ่ายขาย", phone: "081-234-5678", email: "somchai@dealer.co.th", active: true },
  { id: 2, name: "วิภา รัตนกุล",    title: "เจ้าหน้าที่ขาย",   phone: "082-345-6789", email: "wipa@dealer.co.th",    active: true },
  { id: 3, name: "กาญจนา มีสุข",    title: "เจ้าหน้าที่ขาย",   phone: "083-456-7890", email: "kanjana@dealer.co.th", active: true },
  { id: 4, name: "วิชัย ประสิทธิ์", title: "ผู้ช่วยผู้จัดการ",  phone: "084-567-8901", email: "wichai@dealer.co.th",  active: true },
  { id: 5, name: "สุรชัย บุญมา",    title: "เจ้าหน้าที่ขาย",   phone: "085-678-9012", email: "surachai@dealer.co.th", active: false },
];

// โครงสร้างอ้างอิง prisma/schema.prisma

// Sales Journey — 7 ขั้นมาตรฐาน (Dealer สร้าง Lead หลังติดต่อลูกค้าแล้ว → ไม่มีสถานะ "ผู้สนใจใหม่")
// ติดต่อแล้ว → รวบรวมความต้องการ → เสนอราคา → ติดตามผล → เจรจาต่อรอง → ปิดการขาย (Won / Lost)
export type LeadStatus =
  | "WAITING"    // Contacted (ขั้นเริ่มต้น)
  | "BULLET"     // Requirement
  | "QUOTED"     // Quotation
  | "FOLLOWUP"   // Follow-up
  | "NEGO"       // Negotiation
  | "PAID"       // Won
  | "CANCELLED"; // Lost

export const leadStatusLabel: Record<LeadStatus, string> = {
  WAITING:   "ติดต่อแล้ว",
  BULLET:    "รวบรวมความต้องการ",
  QUOTED:    "เสนอราคา",
  FOLLOWUP:  "ติดตามผล",
  NEGO:      "เจรจาต่อรอง",
  PAID:      "ปิดการขายสำเร็จ",
  CANCELLED: "ปิดการขายไม่สำเร็จ",
};

// สีไล่ตามลำดับขั้น: ติดต่อแล้ว (เริ่ม/เทา) → navy → indigo → amber → orange → green(Won) → red(Lost)
export const leadStatusColor: Record<LeadStatus, { bg: string; text: string }> = {
  WAITING:   { bg: "#eef2f7",  text: "#475569" },
  BULLET:    { bg: "#dce5f0",  text: "#003366" },
  QUOTED:    { bg: "#e0e7ff",  text: "#4338ca" },
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

// ─── Global: Lost Reasons (เหตุผลที่เสียโอกาสการขาย) ────────────────
export const LOST_REASONS = ["ราคา", "คู่แข่ง", "งบประมาณ", "ลูกค้าเลื่อน", "ติดต่อไม่ได้", "อื่นๆ"] as const;

// ─── Global: โปรไฟล์ผู้ออกใบเสนอราคา (บริษัทดีลเลอร์) ────────────────
// แหล่งเดียว — ใช้ทั้งหน้าใบเสนอราคา และใบเสนอราคาแบบ inline ในหน้า Lead
// ให้หัวกระดาษ (ชื่อบริษัท/ที่อยู่/โทร/เลขภาษี) ตรงกันทุกที่เมื่อยังไม่ได้ตั้งค่าโปรไฟล์
export type IssuerProfile = { company: string; address: string; phone: string; taxId: string };
export const ISSUER_KEY = "dealer_issuer_profile_v2";
export const DEFAULT_ISSUER: IssuerProfile = {
  company: "บริษัท เชียงใหม่สตีลบิลด์ จำกัด",
  address: "88/9 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100",
  phone: "053-112-233",
  taxId: "0505561001234",
};

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
  lostReason?: string;   // เหตุผลที่ปิดการขายไม่ได้ (เมื่อ status = CANCELLED)
  report?: string;       // รายงานการติดตามลูกค้า (สร้างอัตโนมัติตอนสร้าง Lead · แก้ไขได้ทั้งหมด)
  tasks?: LeadTask[];    // Report Checklist ขับเคลื่อนสถานะ/ความคืบหน้า (Task-driven Sales Journey)
  activities?: LeadActivity[]; // ไทม์ไลน์กิจกรรมของลีด (บันทึกจริง · persist ผ่าน updateLead)
  customerId?: number;
  logo?: string;   // รูป/โลโก้ลูกค้า (base64) — อัปโหลดในฟอร์มเพิ่มผู้สนใจ
};

// กิจกรรมของลีด — บันทึกการโทร/ประชุม/โน้ต ฯลฯ ที่เกิดขึ้นจริง
export type LeadActivity = { id: number; date: string; icon: string; text: string; type: string };

// ─── Task-driven Sales Journey ─────────────────────────────────────
// เช็ก Task → บันทึกเวลา/ผู้ทำ → คำนวณ % (Completed/Total) → เลื่อน Stage อัตโนมัติ
export type LeadTask = { key: string; label: string; done: boolean; doneAt?: string; doneBy?: string };

// เทมเพลต Checklist มาตรฐาน (สร้างอัตโนมัติทุก Lead) + stage ที่แต่ละ task พาไปถึง
export const LEAD_TASK_TEMPLATE: { key: string; label: string; stage: LeadStatus }[] = [
  { key: "contact",     label: "ติดต่อครั้งแรก",      stage: "WAITING"  },
  { key: "collect",     label: "เก็บข้อมูลลูกค้า",     stage: "WAITING"  },
  { key: "requirement", label: "รวบรวมความต้องการ",   stage: "BULLET"   },
  { key: "catalog",     label: "ส่งแคตตาล็อก",        stage: "BULLET"   },
  { key: "appointment", label: "นัดหมาย",            stage: "BULLET"   },
  { key: "makeQuote",   label: "จัดทำใบเสนอราคา",     stage: "QUOTED"   },
  { key: "sendQuote",   label: "ส่งใบเสนอราคา",       stage: "QUOTED"   },
  { key: "followup",    label: "ติดตามผล",           stage: "FOLLOWUP" },
  { key: "negotiate",   label: "เจรจา",              stage: "NEGO"     },
  { key: "close",       label: "ปิดการขาย",          stage: "PAID"     },
];

export function buildLeadTasks(): LeadTask[] {
  return LEAD_TASK_TEMPLATE.map(t => ({ key: t.key, label: t.label, done: false }));
}

// seed งานของลีดตัวอย่างให้ "ตรงสถานะจริง" — เช็กงานครบถึงขั้นของสถานะ พร้อมผู้ทำ/เวลา (deterministic)
// ให้ % ความคืบหน้า/แถบ Kanban/stageFromTasks ของข้อมูลตัวอย่างสอดคล้องกับกลไก Task-driven ปัจจุบัน
const STAGE_RANK: Record<LeadStatus, number> = { WAITING: 0, BULLET: 1, QUOTED: 2, FOLLOWUP: 3, NEGO: 4, PAID: 5, CANCELLED: 2 };
export function seedLeadTasks(status: LeadStatus, doneBy: string, baseDay: number): LeadTask[] {
  const rank = STAGE_RANK[status];
  let day = baseDay;
  return LEAD_TASK_TEMPLATE.map(t => {
    const done = t.key === "close" ? status === "PAID" : STAGE_RANK[t.stage] <= rank;
    const entry: LeadTask = done
      ? { key: t.key, label: t.label, done: true, doneAt: `${Math.min(day, 29)} มิ.ย. 2569 · 10:30`, doneBy }
      : { key: t.key, label: t.label, done: false };
    if (done) day += 2;
    return entry;
  });
}

// ความคืบหน้า = จำนวน task ที่ทำสำเร็จ / ทั้งหมด × 100 (คำนวณอย่างเดียว — ห้ามผู้ใช้กรอก/ลาก)
export function taskProgress(tasks: LeadTask[] = []): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}

// สถานะจาก task ที่ทำล่าสุด (ไม่รวม "ปิดการขาย" ซึ่งแยกเป็น Won/Lost) — ฐานเริ่มที่ "ติดต่อแล้ว"
export function stageFromTasks(tasks: LeadTask[] = []): LeadStatus {
  let stage: LeadStatus = "WAITING";
  for (const def of LEAD_TASK_TEMPLATE) {
    if (def.key === "close") continue;
    if (tasks.find(t => t.key === def.key && t.done)) stage = def.stage;
  }
  return stage;
}

// เทมเพลต "รายงานการติดตามลูกค้า" เริ่มต้น (พรีฟิลจากข้อมูล Lead · ผู้ใช้แก้ไข/เพิ่ม/ลบได้ทั้งหมด)
export function buildLeadReport(lead: Partial<LeadRow>, dateStr = ""): string {
  return [
    "สรุปรายงานการติดตามลูกค้า",
    "",
    `วันที่สร้าง : ${dateStr}`,
    `ผู้รับผิดชอบ : ${lead.assigned ?? ""}`,
    `ลูกค้า : ${lead.contact ?? ""}`,
    `บริษัท : ${lead.company ?? ""}`,
    "",
    "รายละเอียดเบื้องต้น",
    `- ลูกค้าสนใจ : ${lead.product ?? ""}`,
    "- ขนาดโครงการ : ",
    `- จังหวัด : ${lead.province ?? ""}`,
    `- งบประมาณ : ${lead.value ?? ""}`,
    "- ระยะเวลาดำเนินการ : ",
    "",
    "ผลการพูดคุย",
    "- ",
    "",
    "สิ่งที่ต้องดำเนินการต่อ",
    "- ",
    "",
    "หมายเหตุ",
    "- ",
  ].join("\n");
}

export const leads: LeadRow[] = [
  { id: "#L-40322", numId: 1, name: "บจ. ไทยสตีล", company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", email: "somchai@thaisteel.co.th", province: "นนทบุรี", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "QUOTED", value: "฿1.2M", assigned: "สมชาย เชียงใหม่", source: "โทรเข้า", note: "ต้องการโกดัง 1,200 ตร.ม. พร้อมสำนักงาน", customerId: 1, tasks: seedLeadTasks("QUOTED", "สมชาย เชียงใหม่", 10), activities: [ { id: 1, date: "22 มิ.ย. 2569", icon: "doc", text: "ส่งใบเสนอราคา Q-2026-0089 ให้ลูกค้า", type: "doc" }, { id: 2, date: "18 มิ.ย. 2569", icon: "meeting", text: "ประชุมเก็บความต้องการโกดัง 1,200 ตร.ม.", type: "meeting" }, { id: 3, date: "12 มิ.ย. 2569", icon: "call", text: "โทรแนะนำบริษัทและแม่แบบโกดังสำเร็จรูป", type: "call" } ] },
  { id: "#L-40323", numId: 2, name: "บจ. ซีซีเอส", company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", email: "kanchana@ccs.co.th", province: "เชียงใหม่", product: "อาคารสำเร็จรูปทุกประเภท", category: "อาคารสำเร็จรูปทุกประเภท", status: "WAITING", value: "฿480K", assigned: "วิภา รัตนกุล", source: "เว็บไซต์", customerId: 2, tasks: seedLeadTasks("WAITING", "วิภา รัตนกุล", 24), activities: [ { id: 1, date: "26 มิ.ย. 2569", icon: "call", text: "ติดต่อครั้งแรก — ลูกค้าสนใจอาคารสำนักงานสำเร็จรูป", type: "call" } ] },
  { id: "#L-40324", numId: 3, name: "หจก. ราชบุรีโลหะ", company: "หจก. ราชบุรีโลหะ", contact: "คุณประยุทธ ร.", phone: "083-456-7890", email: "prayut@rajburimetal.com", province: "ราชบุรี", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "BULLET", value: "฿3.1M", assigned: "วิภา รัตนกุล", source: "แนะนำ", note: "ขอต่อรองราคาในใบเสนอราคา", customerId: 3, tasks: seedLeadTasks("BULLET", "วิภา รัตนกุล", 16), activities: [ { id: 1, date: "24 มิ.ย. 2569", icon: "email", text: "ส่งแคตตาล็อกโกดังสำเร็จรูปให้ลูกค้า", type: "email" }, { id: 2, date: "20 มิ.ย. 2569", icon: "call", text: "โทรสอบถามขนาดพื้นที่และงบประมาณ", type: "call" } ] },
  { id: "#L-40325", numId: 4, name: "บจ. สมุทรโกดัง", company: "บจ. สมุทรโกดัง", contact: "คุณดารัล ส.", phone: "084-567-8901", email: "daran@samutwarehouse.co.th", province: "สมุทรปราการ", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "WAITING", value: "฿2.0M", assigned: "สมชาย เชียงใหม่", source: "งานแสดงสินค้า", customerId: 4, tasks: seedLeadTasks("WAITING", "สมชาย เชียงใหม่", 25), activities: [ { id: 1, date: "25 มิ.ย. 2569", icon: "meeting", text: "พบลูกค้าที่บูธงานแสดงสินค้า — แลกนามบัตร", type: "meeting" } ] },
  { id: "#L-40326", numId: 5, name: "บจ. นครสวรรค์โลหะ", company: "บจ. นครสวรรค์โลหะ", contact: "คุณวิชัย น.", phone: "085-678-9012", email: "wichai@nsmetal.co.th", province: "นครสวรรค์", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "WAITING", value: "฿760K", assigned: "กาญจนา มีสุข", source: "Facebook", customerId: 8, tasks: seedLeadTasks("WAITING", "กาญจนา มีสุข", 26), activities: [ { id: 1, date: "27 มิ.ย. 2569", icon: "note", text: "ทักมาจากเพจ Facebook — ขอข้อมูลโกดังขนาดเล็ก", type: "note" } ] },
  { id: "#L-40328", numId: 7,  name: "บจ. ลำปางแพ็คเกจจิ้ง", company: "บจ. ลำปางแพ็คเกจจิ้ง", contact: "คุณอรทัย พ.", phone: "089-111-2233", email: "orathai@lpkg.co.th", province: "ลำปาง", product: "โรงงาน", category: "โรงงาน", status: "PAID", value: "฿3.6M", assigned: "วิภา รัตนกุล", source: "แนะนำ", note: "ปิดการขายแล้ว — โรงงานบรรจุภัณฑ์ 1,800 ตร.ม.", customerId: 10, tasks: seedLeadTasks("PAID", "วิภา รัตนกุล", 2), activities: [ { id: 1, date: "20 มิ.ย. 2569", icon: "doc", text: "ปิดการขายสำเร็จ — เซ็นสัญญา ฿3.6M", type: "doc" }, { id: 2, date: "14 มิ.ย. 2569", icon: "meeting", text: "เจรจาส่วนลดรอบสุดท้าย 3%", type: "meeting" } ] },
  { id: "#L-40329", numId: 8,  name: "บจ. พิษณุโลกฟาร์ม", company: "บจ. พิษณุโลกฟาร์ม", contact: "คุณธนา ก.", phone: "089-222-3344", email: "thana@plkfarm.co.th", province: "พิษณุโลก", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "NEGO", value: "฿2.7M", assigned: "สมชาย เชียงใหม่", source: "เว็บไซต์", note: "ต่อรองราคาโกดังเก็บข้าว 1,400 ตร.ม.", tasks: seedLeadTasks("NEGO", "สมชาย เชียงใหม่", 8), activities: [ { id: 1, date: "26 มิ.ย. 2569", icon: "call", text: "โทรเจรจาราคา — ลูกค้าขอส่วนลดเพิ่ม 5%", type: "call" }, { id: 2, date: "19 มิ.ย. 2569", icon: "doc", text: "ส่งใบเสนอราคา Q-2026-0101", type: "doc" } ] },
  { id: "#L-40330", numId: 9,  name: "หจก. เชียงใหม่ค้าวัสดุ", company: "หจก. เชียงใหม่ค้าวัสดุ", contact: "คุณมานพ ว.", phone: "089-333-4455", email: "manop@cmmaterial.co.th", province: "เชียงใหม่", product: "งานรีโนเวท", category: "งานรีโนเวท", status: "NEGO", value: "฿890K", assigned: "กาญจนา มีสุข", source: "LINE", note: "รีโนเวทโกดังเดิม เพิ่มชั้นลอย", tasks: seedLeadTasks("NEGO", "กาญจนา มีสุข", 9), activities: [ { id: 1, date: "27 มิ.ย. 2569", icon: "meeting", text: "ประชุมสรุปขอบเขตงานรีโนเวท", type: "meeting" } ] },
  { id: "#L-40331", numId: 10, name: "บจ. ลำพูนอิเล็กทรอนิกส์", company: "บจ. ลำพูนอิเล็กทรอนิกส์", contact: "คุณศิริพร บ.", phone: "089-444-5566", email: "siriporn@lpelec.co.th", province: "ลำพูน", product: "โรงงาน", category: "โรงงาน", status: "FOLLOWUP", value: "฿4.8M", assigned: "วิภา รัตนกุล", source: "งานแสดงสินค้า", note: "โรงงานชิ้นส่วนอิเล็กทรอนิกส์ นิคมลำพูน", tasks: seedLeadTasks("FOLLOWUP", "วิภา รัตนกุล", 12), activities: [ { id: 1, date: "25 มิ.ย. 2569", icon: "call", text: "โทรติดตามใบเสนอราคา — ลูกค้ากำลังเทียบผู้รับเหมา", type: "call" }, { id: 2, date: "17 มิ.ย. 2569", icon: "doc", text: "ส่งใบเสนอราคา Q-2026-0102", type: "doc" } ] },
  { id: "#L-40332", numId: 11, name: "โรงเรียนนานาชาติเชียงใหม่", company: "โรงเรียนนานาชาติเชียงใหม่", contact: "คุณเดวิด ล.", phone: "089-555-6677", email: "david@cmis.ac.th", province: "เชียงใหม่", product: "สนามกีฬาในร่ม", category: "สนามกีฬาในร่ม", status: "FOLLOWUP", value: "฿6.5M", assigned: "สมชาย เชียงใหม่", source: "แนะนำ", note: "โรงยิมอเนกประสงค์ 2,000 ตร.ม.", tasks: seedLeadTasks("FOLLOWUP", "สมชาย เชียงใหม่", 11), activities: [ { id: 1, date: "24 มิ.ย. 2569", icon: "email", text: "ส่งข้อมูลเพิ่มเรื่องระบบระบายอากาศ", type: "email" } ] },
  { id: "#L-40333", numId: 12, name: "บจ. แพร่วู้ดโปรดักส์", company: "บจ. แพร่วู้ดโปรดักส์", contact: "คุณสมบัติ จ.", phone: "089-666-7788", email: "sombat@phraewood.co.th", province: "แพร่", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "QUOTED", value: "฿1.9M", assigned: "กาญจนา มีสุข", source: "Facebook", note: "โกดังเก็บไม้แปรรูป 1,000 ตร.ม.", tasks: seedLeadTasks("QUOTED", "กาญจนา มีสุข", 15), activities: [ { id: 1, date: "23 มิ.ย. 2569", icon: "doc", text: "จัดทำใบเสนอราคา Q-2026-0103", type: "doc" } ] },
  { id: "#L-40334", numId: 13, name: "สหกรณ์การเกษตรเชียงดาว", company: "สหกรณ์การเกษตรเชียงดาว", contact: "คุณบุญมี ส.", phone: "089-777-8899", email: "boonmee@cdcoop.or.th", province: "เชียงใหม่", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "BULLET", value: "฿1.4M", assigned: "วิภา รัตนกุล", source: "Walk-in", note: "ไซโลและโกดังเก็บข้าวโพด", tasks: seedLeadTasks("BULLET", "วิภา รัตนกุล", 20), activities: [ { id: 1, date: "25 มิ.ย. 2569", icon: "meeting", text: "ลงพื้นที่ดูหน้างานที่เชียงดาว", type: "meeting" } ] },
  { id: "#L-40335", numId: 14, name: "บจ. น่านโลจิสติกส์", company: "บจ. น่านโลจิสติกส์", contact: "คุณพงศกร น.", phone: "089-888-9900", email: "pongsakorn@nanlogis.co.th", province: "น่าน", product: "งานตามแบบของลูกค้า", category: "งานตามแบบของลูกค้า", status: "WAITING", value: "฿3.3M", assigned: "สมชาย เชียงใหม่", source: "โทรเข้า", note: "ศูนย์กระจายสินค้าตามแบบเฉพาะ", tasks: seedLeadTasks("WAITING", "สมชาย เชียงใหม่", 27), activities: [ { id: 1, date: "28 มิ.ย. 2569", icon: "call", text: "ลูกค้าโทรเข้ามาสอบถาม — นัดเก็บความต้องการสัปดาห์หน้า", type: "call" } ] },
  { id: "#L-40336", numId: 15, name: "บจ. เชียงรายฟู้ดส์", company: "บจ. เชียงรายฟู้ดส์", contact: "คุณรัชนี ก.", phone: "089-999-0011", email: "ratchanee@crfoods.co.th", province: "เชียงราย", product: "โรงงาน", category: "โรงงาน", status: "CANCELLED", value: "฿2.2M", assigned: "กาญจนา มีสุข", source: "เว็บไซต์", lostReason: "ราคา", note: "เลือกผู้รับเหมาท้องถิ่น ราคาต่ำกว่า 12%", tasks: seedLeadTasks("CANCELLED", "กาญจนา มีสุข", 5), activities: [ { id: 1, date: "18 มิ.ย. 2569", icon: "note", text: "ลูกค้าแจ้งเลือกเจ้าอื่น — เหตุผลด้านราคา", type: "note" } ] },
  { id: "#L-40337", numId: 16, name: "หจก. แม่ฮ่องสอนพาณิชย์", company: "หจก. แม่ฮ่องสอนพาณิชย์", contact: "คุณอนุชา ม.", phone: "089-000-1122", email: "anucha@mhscon.co.th", province: "แม่ฮ่องสอน", product: "อาคารสำเร็จรูปทุกประเภท", category: "อาคารสำเร็จรูปทุกประเภท", status: "CANCELLED", value: "฿950K", assigned: "วิภา รัตนกุล", source: "แนะนำ", lostReason: "งบประมาณ", note: "โครงการถูกพับ — งบไม่อนุมัติ", tasks: seedLeadTasks("CANCELLED", "วิภา รัตนกุล", 3), activities: [ { id: 1, date: "10 มิ.ย. 2569", icon: "call", text: "ลูกค้าแจ้งพับโครงการ งบประมาณไม่ผ่าน", type: "call" } ] },
  { id: "#L-40327", numId: 6, name: "บจ. ทีทีวาย", company: "บจ. ทีทีวาย อินเตอร์", contact: "คุณวิทยา ท.", phone: "086-789-0123", email: "wittaya@ttyinter.com", province: "นครสวรรค์", product: "โกดังสำเร็จรูป", category: "โกดังสำเร็จรูป", status: "PAID", value: "฿5.4M", assigned: "สมชาย เชียงใหม่", source: "แนะนำ", note: "ปิดการขายแล้ว รอทำสัญญา", customerId: 9, tasks: seedLeadTasks("PAID", "สมชาย เชียงใหม่", 4), activities: [ { id: 1, date: "28 มิ.ย. 2569", icon: "doc", text: "ปิดการขายสำเร็จ — ลูกค้ายืนยันสั่งซื้อ ฿5.4M", type: "doc" }, { id: 2, date: "21 มิ.ย. 2569", icon: "meeting", text: "เจรจาราคารอบสุดท้าย ตกลงเงื่อนไขชำระเงิน", type: "meeting" } ] },
];

// ─── CUSTOMER ROWS (rich, shared app-wide via SalesContext) ───
// แหล่งความจริงเดียวของ "ลูกค้า" ที่ใช้ทั้งหน้า ลูกค้า / ใบเสนอราคา / การแปลงจากลีด
export type CustomerStatus = "active" | "inactive";
export type CustomerType   = "บุคคล" | "บริษัท";
// บันทึกการติดต่อลูกค้า (โทร/อีเมล/ประชุม ฯลฯ) — persist จริงผ่าน updateCustomer
export type CustomerContact = { id:number; date:string; icon:string; text:string; type:string };
export type CustomerRow = {
  id:number; name:string; company:string; type:CustomerType; email:string; phone:string;
  province:string; category:string; status:CustomerStatus; projects:number;
  joinDate:string; owner:string; initials:string; color:string;
  totalValue:number; contacts?:CustomerContact[];
  logo?:string;   // รูป/โลโก้ลูกค้า (base64) — อัปโหลด/แก้ไขในแท็บ "ข้อมูล"
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
  { id:9, name:"คุณวิทยา ท.",          company:"บจ. ทีทีวาย อินเตอร์",  type:"บริษัท", email:"wittaya@ttyinter.com",     phone:"086-789-0123", province:"นครสวรรค์",    category:"โกดัง/คลังสินค้า", status:"active", projects:1, joinDate:"2026-06-28", owner:"สมชาย เชียงใหม่", initials:"ทท", color:"#003366", totalValue:5400000 },
  { id:10, name:"คุณอรทัย พ.",         company:"บจ. ลำปางแพ็คเกจจิ้ง",  type:"บริษัท", email:"orathai@lpkg.co.th",       phone:"089-111-2233", province:"ลำปาง",        category:"โรงงาน", status:"active", projects:1, joinDate:"2026-06-20", owner:"วิภา รัตนกุล", initials:"ลป", color:"#059669", totalValue:3600000, contacts:[ { id:1, date:"20 มิ.ย. 2569", icon:"meeting", text:"เซ็นสัญญาซื้อขายโรงงาน ฿3.6M", type:"meeting" } ] },
  { id:11, name:"คุณประเสริฐ อ.",      company:"บจ. เอกชัยสตอเรจ",      type:"บริษัท", email:"prasert@ekachai.co.th",    phone:"089-333-2211", province:"ลำปาง",        category:"โกดัง/คลังสินค้า", status:"active", projects:2, joinDate:"2025-10-12", owner:"กาญจนา มีสุข", initials:"อช", color:"#003366", totalValue:2450000 },
  { id:12, name:"คุณนภา ว.",           company:"คุณนภา วงศ์สวรรค์",     type:"บุคคล",  email:"napa.w@gmail.com",          phone:"089-444-3322", province:"เชียงใหม่",    category:"อื่นๆ", status:"active", projects:1, joinDate:"2026-03-05", owner:"วิภา รัตนกุล", initials:"นภ", color:"#f59e0b", totalValue:680000 },
  { id:13, name:"คุณกิตติ ธ.",          company:"หจก. พะเยาเทรดดิ้ง",    type:"บริษัท", email:"kitti@phayaotrading.co.th", phone:"089-555-4433", province:"พะเยา",        category:"เกษตรกรรม", status:"inactive", projects:0, joinDate:"2025-09-01", owner:"สมชาย เชียงใหม่", initials:"พย", color:"#8fa3b8", totalValue:1150000 },
];

// ─── แม่แบบอาคาร (Building Templates — กำหนดโดย HQ, ดีลเลอร์ดูอย่างเดียว) ───
// แหล่งข้อมูลกลาง: ใช้ทั้งหน้า "แม่แบบ" (/products) และ dropdown "แม่แบบที่สนใจ" ในฟอร์มผู้สนใจ
export type SolutionPriceHistory = { price: number; effectiveDate: string; note?: string };
export type SolutionProduct = {
  id: string; name: string; spec: string;
  price: number; unit: string; effectiveDate: string; priceHistory: SolutionPriceHistory[];
};

// ─── Master Catalog (แหล่งเดียว) ─────────────────────────────────
// HQ (หน้า /hq/master) เป็นผู้แก้ไขแม่แบบ/ราคากลาง → persist ลง localStorage คีย์นี้
// Dealer (/products + dropdown ในฟอร์ม) อ่านจากคีย์เดียวกัน — fallback = solutionProducts
export const MASTER_CATALOG_KEY = "master_catalog";
export function loadMasterCatalog(): SolutionProduct[] {
  if (typeof window === "undefined") return solutionProducts;
  try {
    const s = localStorage.getItem(MASTER_CATALOG_KEY);
    if (s) { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length) return arr; }
  } catch {}
  return solutionProducts;
}
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
  discountPct?: number; // ส่วนลด %
  note?: string;        // หมายเหตุ
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
  { id: "Q-2026-0096", customer: "บจ. ทีทีวาย อินเตอร์", project: "โกดังสำเร็จรูป ทีทีวาย", total: "฿5,400,000", totalValue: 5400000, materialCost: 5400000, province: "นครสวรรค์", buildingType: "โกดังสำเร็จรูป", area: 2400, status: "won", date: "2026-06-28", items: 10, customerId: 9, projectId: 0 },
  { id: "Q-2026-0089", customer: "บจ. ไทยสตีล", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", total: "฿1,800,000", totalValue: 1800000, materialCost: 1800000, province: "นนทบุรี", buildingType: "โกดังสำเร็จรูป", area: 960, status: "won", date: "2026-05-15", items: 8, customerId: 1, projectId: 1 },
  { id: "Q-2026-0091", customer: "หจก. ราชบุรีโลหะ", project: "โกดังสำเร็จรูป ราชบุรี", total: "฿760,000", totalValue: 760000, materialCost: 760000, province: "ราชบุรี", buildingType: "โกดังสำเร็จรูป", area: 480, status: "sent_to_client", date: "2026-06-01", items: 5, customerId: 3, projectId: 5 },
  { id: "Q-2026-0092", customer: "VCS Asia", project: "โกดังระยอง VCS Asia", total: "฿6,200,000", totalValue: 6200000, materialCost: 6200000, province: "ระยอง", buildingType: "โรงงาน", area: 3200, status: "won", date: "2025-11-10", items: 15, customerId: 5, projectId: 8 },
  { id: "Q-2026-0095", customer: "บจ. ซีซีเอส", project: "โรงงาน อาคารสำเร็จรูป เชียงใหม่", total: "฿3,200,000", totalValue: 3200000, materialCost: 3200000, province: "เชียงใหม่", buildingType: "โรงงาน", area: 1800, status: "sent_to_client", date: "2026-06-10", items: 12, customerId: 2, projectId: 2 },
  { id: "Q-2026-0097", customer: "บจ. สมุทรโกดัง", project: "โกดังปากน้ำ พระปราชญ์", total: "฿2,000,000", totalValue: 2000000, materialCost: 2000000, province: "สมุทรปราการ", buildingType: "โกดังสำเร็จรูป", area: 1200, status: "sent_to_client", date: "2026-06-18", items: 7, customerId: 4, projectId: 3 },
  { id: "Q-2026-0098", customer: "บจ. อุตรดิตถ์โลหะ", project: "อาคารสำเร็จรูป อุตรดิตถ์", total: "฿2,800,000", totalValue: 2800000, materialCost: 2800000, province: "อุตรดิตถ์", buildingType: "โรงงาน", area: 1600, status: "draft", date: "2026-06-20", items: 9, customerId: 7, projectId: 7 },
  { id: "Q-2026-0099", customer: "บจ. นครสวรรค์โลหะ", project: "โรงงานสำเร็จรูป นครสวรรค์", total: "฿5,400,000", totalValue: 5400000, materialCost: 5400000, province: "นครสวรรค์", buildingType: "โรงงาน", area: 2800, status: "won", date: "2026-04-05", items: 18, customerId: 8, projectId: 6 },
  { id: "Q-2026-0100", customer: "บจ. เชียงรายเมทัล", project: "โกดังสำเร็จรูป เชียงราย", total: "฿1,500,000", totalValue: 1500000, materialCost: 1500000, province: "เชียงราย", buildingType: "โกดังสำเร็จรูป", area: 720, status: "lost", date: "2026-05-28", items: 6, customerId: 0, projectId: 9 },
  { id: "Q-2026-0101", customer: "บจ. พิษณุโลกฟาร์ม", project: "โกดังเก็บข้าว พิษณุโลก", total: "฿2,700,000", totalValue: 2700000, materialCost: 2700000, province: "พิษณุโลก", buildingType: "โกดังสำเร็จรูป", area: 1400, status: "viewed", date: "2026-06-19", items: 9, customerId: 0, projectId: 0, discountPct: 5, expiry: "2026-07-19" },
  { id: "Q-2026-0102", customer: "บจ. ลำพูนอิเล็กทรอนิกส์", project: "โรงงานชิ้นส่วนอิเล็กทรอนิกส์ ลำพูน", total: "฿4,800,000", totalValue: 4800000, materialCost: 4800000, province: "ลำพูน", buildingType: "โรงงาน", area: 2200, status: "sent_to_client", date: "2026-06-17", items: 14, customerId: 0, projectId: 0, expiry: "2026-07-17" },
  { id: "Q-2026-0103", customer: "บจ. แพร่วู้ดโปรดักส์", project: "โกดังเก็บไม้แปรรูป แพร่", total: "฿1,900,000", totalValue: 1900000, materialCost: 1900000, province: "แพร่", buildingType: "โกดังสำเร็จรูป", area: 1000, status: "sent_to_client", date: "2026-06-23", items: 7, customerId: 0, projectId: 0, expiry: "2026-07-23" },
  { id: "Q-2026-0104", customer: "บจ. ลำปางแพ็คเกจจิ้ง", project: "โรงงานบรรจุภัณฑ์ ลำปาง", total: "฿3,600,000", totalValue: 3600000, materialCost: 3600000, province: "ลำปาง", buildingType: "โรงงาน", area: 1800, status: "won", date: "2026-06-20", items: 12, customerId: 10, projectId: 0, discountPct: 3 },
  { id: "Q-2026-0105", customer: "หจก. เชียงใหม่ค้าวัสดุ", project: "รีโนเวทโกดัง เพิ่มชั้นลอย", total: "฿890,000", totalValue: 890000, materialCost: 890000, province: "เชียงใหม่", buildingType: "งานรีโนเวท", area: 450, status: "viewed", date: "2026-06-22", items: 5, customerId: 0, projectId: 0, expiry: "2026-07-22" },
  { id: "Q-2026-0106", customer: "โรงเรียนนานาชาติเชียงใหม่", project: "โรงยิมอเนกประสงค์ CMIS", total: "฿6,500,000", totalValue: 6500000, materialCost: 6500000, province: "เชียงใหม่", buildingType: "สนามกีฬาในร่ม", area: 2000, status: "sent_to_client", date: "2026-06-16", items: 16, customerId: 0, projectId: 0, expiry: "2026-07-16" },
  { id: "Q-2026-0107", customer: "บจ. เชียงรายฟู้ดส์", project: "โรงงานแปรรูปอาหาร เชียงราย", total: "฿2,200,000", totalValue: 2200000, materialCost: 2200000, province: "เชียงราย", buildingType: "โรงงาน", area: 1100, status: "lost", date: "2026-06-05", items: 8, customerId: 0, projectId: 0, note: "แพ้ราคาผู้รับเหมาท้องถิ่น" },
  { id: "Q-2026-0108", customer: "บจ. เอกชัยสตอเรจ", project: "คลังสินค้า เฟส 2 ลำปาง", total: "฿1,650,000", totalValue: 1650000, materialCost: 1650000, province: "ลำปาง", buildingType: "โกดังสำเร็จรูป", area: 850, status: "expired", date: "2026-04-02", items: 6, customerId: 11, projectId: 0, expiry: "2026-05-02", note: "ลูกค้าเลื่อนโครงการ — ใบเสนอราคาหมดอายุ" },
];

// ─── TEAM ─────────────────────────────────────────────────────
export type TeamMock = {
  id: number; name: string; role: string; dept: string;
  initials: string; color: string; tasks: number; projects: number; phone: string;
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

// บริษัทตัวแทนจำหน่าย (เครือข่ายตัวแทน)
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
  { id: "RYG", code: "RYG", name: "บจ. ระยองสตีลเวิร์คส์",      region: "ตะวันออก", revenueActual: 5400000, revenueTarget: 6000000, winRate: 48, activeProjects: 6, onTimePct: 91, status: "active",   credentials: { email: "sales@rayongsteel.co.th", password: "PEB-RYG-4821" } },
  { id: "CNX", code: "CNX", name: "บจ. เชียงใหม่สตีลบิลด์",   region: "เหนือ",    revenueActual: 4200000, revenueTarget: 6200000, winRate: 35, activeProjects: 5, onTimePct: 78, status: "active",   credentials: { email: "sales@cmsteelbuild.co.th", password: "PEB-CNX-3317" } },
  { id: "MST", code: "MST", name: "หจก. แม่สอดเมทัลเวิร์ค",      region: "ตะวันตก", revenueActual: 3800000, revenueTarget: 5000000, winRate: 52, activeProjects: 4, onTimePct: 85, status: "active",   credentials: { email: "sales@maesotmetal.co.th", password: "PEB-MST-7749" } },
  { id: "CRI", code: "CRI", name: "บจ. เชียงรายสตรัคเจอร์",    region: "เหนือ",    revenueActual: 3100000, revenueTarget: 5800000, winRate: 41, activeProjects: 3, onTimePct: 72, status: "active",   credentials: { email: "sales@crstructure.co.th", password: "PEB-CRI-5563" } },
  { id: "NSN", code: "NSN", name: "บจ. นครสวรรค์เอ็นจิเนียริ่ง",   region: "กลาง",     revenueActual: 1900000, revenueTarget: 5000000, winRate: 29, activeProjects: 2, onTimePct: 61, status: "active",   credentials: { email: "sales@nsn-engineering.co.th", password: "PEB-NSN-2294" } },
  { id: "HYI", code: "HYI", name: "บจ. หาดใหญ่สตีลกรุ๊ป",    region: "ใต้",      revenueActual: 920000,  revenueTarget: 4000000, winRate: 18, activeProjects: 1, onTimePct: 0,  status: "inactive", credentials: { email: "sales@hatyaisteel.co.th", password: "PEB-HYI-1108" } },
  { id: "AYA", code: "AYA", name: "บจ. อยุธยาเมทัลบิลด์",     region: "กลาง",     revenueActual: 4650000, revenueTarget: 5200000, winRate: 47, activeProjects: 5, onTimePct: 90, status: "active",   credentials: { email: "sales@ayametalbuild.co.th", password: "PEB-AYA-6612" } },
  { id: "KKN", code: "KKN", name: "หจก. ขอนแก่นโครงเหล็ก",   region: "อีสาน",    revenueActual: 3450000, revenueTarget: 4800000, winRate: 44, activeProjects: 4, onTimePct: 88, status: "active",   credentials: { email: "sales@kksteelframe.co.th", password: "PEB-KKN-9034" } },
  { id: "UBN", code: "UBN", name: "บจ. อุบลสตีลกรุ๊ป",        region: "อีสาน",    revenueActual: 2750000, revenueTarget: 4500000, winRate: 33, activeProjects: 3, onTimePct: 74, status: "active",   credentials: { email: "sales@ubonsteel.co.th", password: "PEB-UBN-4478" } },
  { id: "PKT", code: "PKT", name: "บจ. ภูเก็ตสตรัคเจอรัล",   region: "ใต้",      revenueActual: 2300000, revenueTarget: 3500000, winRate: 38, activeProjects: 2, onTimePct: 81, status: "active",   credentials: { email: "sales@phuketstructural.co.th", password: "PEB-PKT-2851" } },
];

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

export type AppointmentMock = {
  id: number; company: string; contact: string; phone: string;
  project: string; buildingType: string; area: number; province: string;
  date: string; time: string; type: ApptType; assigned: string;
  status: ApptStatus; note: string;
};

export const appointments: AppointmentMock[] = [
  { id: 11, company: "หจก. ราชบุรีโลหะ", contact: "คุณประยุทธ ร.", phone: "083-456-7890", project: "โกดังสำเร็จรูป ราชบุรี", buildingType: "โกดังสำเร็จรูป", area: 480, province: "ราชบุรี", date: "2026-06-30", time: "14:00", type: "visit", assigned: "วิภา รัตนกุล", status: "upcoming", note: "นัดพบเก็บความต้องการเพิ่มเติม" },
  { id: 1, company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 1200, province: "นนทบุรี", date: "2026-06-24", time: "09:00", type: "visit", assigned: "สมชาย", status: "upcoming", note: "นัดพบลูกค้าคุยความต้องการโกดังสินค้า" },
  { id: 2, company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", project: "โรงงานสำเร็จรูป บจ. ซีซีเอส", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 800, province: "เชียงใหม่", date: "2026-06-24", time: "13:30", type: "design_meet", assigned: "วิภา", status: "upcoming", note: "นำเสนอแบบและสเปกสินค้า" },
  { id: 3, company: "บจ. ไทยสตีล", contact: "คุณสมชาย ใจดี", phone: "081-234-5678", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 1200, province: "นนทบุรี", date: "2026-06-26", time: "09:00", type: "contract_sign", assigned: "สมชาย", status: "upcoming", note: "เซ็นสัญญาซื้อขาย" },
  { id: 4, company: "บจ. ซีซีเอส", contact: "คุณกาญจนา ม.", phone: "082-345-6789", project: "โรงงานสำเร็จรูป บจ. ซีซีเอส", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 800, province: "เชียงใหม่", date: "2026-06-30", time: "13:00", type: "follow_up", assigned: "สมชาย", status: "upcoming", note: "ติดตามผลใบเสนอราคา" },
  { id: 5, company: "บจ. สมุทรโกดัง", contact: "คุณดารัล ส.", phone: "084-567-8901", project: "โกดังปากน้ำ พระปราชญ์", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 2000, province: "สมุทรปราการ", date: "2026-07-03", time: "08:00", type: "visit", assigned: "วิชัย", status: "upcoming", note: "นัดพบลูกค้าเก็บความต้องการ" },
  { id: 6, company: "หจก. ราชบุรีโลหะ", contact: "คุณประยุทธ ร.", phone: "083-456-7890", project: "โกดังสำเร็จรูป ราชบุรี", buildingType: "โกดังสำเร็จรูป", area: 3100, province: "ราชบุรี", date: "2026-07-05", time: "10:00", type: "presentation", assigned: "วิภา", status: "upcoming", note: "นำเสนอใบเสนอราคาฉบับปรับปรุง" },
  { id: 7, company: "บจ. แม่สอดโลหะ", contact: "คุณสุรัตน์ ล.", phone: "086-789-0123", project: "อาคารสำเร็จรูป แม่สอด", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 4100, province: "ตาก", date: "2026-06-15", time: "10:00", type: "visit", assigned: "สมชาย", status: "done", note: "พบลูกค้าเรียบร้อย รอติดตามผล" },
  { id: 8, company: "VCS Asia", contact: "VCS Asia (ระยอง)", phone: "085-678-9012", project: "โกดังระยอง VCS Asia", buildingType: "โกดังสำเร็จรูป", area: 6200, province: "ระยอง", date: "2026-02-25", time: "13:00", type: "close", assigned: "วิชัย", status: "done", note: "ปิดการขายเรียบร้อย" },
  { id: 9, company: "บจ. นครสวรรค์โลหะ", contact: "บจ. นครสวรรค์โลหะ", phone: "088-901-2345", project: "โรงงานสำเร็จรูป นครสวรรค์", buildingType: "โรงงาน", area: 5400, province: "นครสวรรค์", date: "2026-03-15", time: "14:00", type: "follow_up", assigned: "กาญจนา", status: "done", note: "โทรติดตามหลังปิดการขาย" },
  { id: 10, company: "บจ. อุตรดิตถ์โลหะ", contact: "บจ. อุตรดิตถ์โลหะ", phone: "087-890-1234", project: "อาคารสำเร็จรูป อุตรดิตถ์", buildingType: "อาคารสำเร็จรูปทุกประเภท", area: 2800, province: "อุตรดิตถ์", date: "2026-07-10", time: "10:00", type: "presentation", assigned: "วิภา", status: "cancelled", note: "ลูกค้าขอเลื่อน" },
  { id: 12, company: "บจ. พิษณุโลกฟาร์ม", contact: "คุณธนา ก.", phone: "089-222-3344", project: "โกดังเก็บข้าว พิษณุโลก", buildingType: "โกดังสำเร็จรูป", area: 1400, province: "พิษณุโลก", date: "2026-06-30", time: "10:30", type: "presentation", assigned: "สมชาย เชียงใหม่", status: "upcoming", note: "นำเสนอราคาปรับปรุงหลังต่อรอง" },
  { id: 13, company: "บจ. ลำพูนอิเล็กทรอนิกส์", contact: "คุณศิริพร บ.", phone: "089-444-5566", project: "โรงงานชิ้นส่วนอิเล็กทรอนิกส์", buildingType: "โรงงาน", area: 2200, province: "ลำพูน", date: "2026-07-01", time: "09:30", type: "follow_up", assigned: "วิภา รัตนกุล", status: "upcoming", note: "โทรติดตามผลการเทียบราคา" },
  { id: 14, company: "โรงเรียนนานาชาติเชียงใหม่", contact: "คุณเดวิด ล.", phone: "089-555-6677", project: "โรงยิมอเนกประสงค์ CMIS", buildingType: "สนามกีฬาในร่ม", area: 2000, province: "เชียงใหม่", date: "2026-07-02", time: "14:00", type: "design_meet", assigned: "สมชาย เชียงใหม่", status: "upcoming", note: "นำเสนอแบบโครงหลังคาช่วงกว้าง" },
  { id: 15, company: "สหกรณ์การเกษตรเชียงดาว", contact: "คุณบุญมี ส.", phone: "089-777-8899", project: "โกดังเก็บข้าวโพด เชียงดาว", buildingType: "โกดังสำเร็จรูป", area: 700, province: "เชียงใหม่", date: "2026-07-03", time: "13:00", type: "visit", assigned: "วิภา รัตนกุล", status: "upcoming", note: "ลงพื้นที่วัดขนาดหน้างานรอบ 2" },
  { id: 16, company: "หจก. เชียงใหม่ค้าวัสดุ", contact: "คุณมานพ ว.", phone: "089-333-4455", project: "รีโนเวทโกดัง เพิ่มชั้นลอย", buildingType: "งานรีโนเวท", area: 450, province: "เชียงใหม่", date: "2026-07-06", time: "11:00", type: "contract_sign", assigned: "กาญจนา มีสุข", status: "upcoming", note: "นัดเซ็นสัญญาหลังตกลงราคาได้" },
  { id: 17, company: "บจ. ลำปางแพ็คเกจจิ้ง", contact: "คุณอรทัย พ.", phone: "089-111-2233", project: "โรงงานบรรจุภัณฑ์ ลำปาง", buildingType: "โรงงาน", area: 1800, province: "ลำปาง", date: "2026-06-20", time: "10:00", type: "close", assigned: "วิภา รัตนกุล", status: "done", note: "ปิดการขาย + เซ็นสัญญา ฿3.6M เรียบร้อย" },
  { id: 18, company: "บจ. แพร่วู้ดโปรดักส์", contact: "คุณสมบัติ จ.", phone: "089-666-7788", project: "โกดังเก็บไม้แปรรูป แพร่", buildingType: "โกดังสำเร็จรูป", area: 1000, province: "แพร่", date: "2026-06-18", time: "13:30", type: "visit", assigned: "กาญจนา มีสุข", status: "done", note: "เก็บความต้องการครบ พร้อมทำใบเสนอราคา" },
  { id: 19, company: "บจ. น่านโลจิสติกส์", contact: "คุณพงศกร น.", phone: "089-888-9900", project: "ศูนย์กระจายสินค้า น่าน", buildingType: "งานตามแบบของลูกค้า", area: 1600, province: "น่าน", date: "2026-07-07", time: "09:00", type: "visit", assigned: "สมชาย เชียงใหม่", status: "upcoming", note: "นัดเก็บความต้องการครั้งแรก" },
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
  valueNum: number; status: "contacted" | "quoted" | "won" | "lost";
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
  status: QuotationStatus;
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
      { id: "LD-R01", name: "บจ. แหลมฉบัง อุตสาหกรรม", province: "ชลบุรี",    product: "โรงงาน",  valueNum: 4200000, status: "quoted",    assignedAt: "3 วันก่อน" },
      { id: "LD-R02", name: "หจก. มาบตาพุดโลหะ",       province: "ระยอง",     product: "โกดังสำเร็จรูป", valueNum: 1800000, status: "contacted", assignedAt: "1 สัปดาห์" },
      { id: "LD-R03", name: "บจ. ชลอุตสาหกรรม",        province: "ชลบุรี",    product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 2600000, status: "contacted", assignedAt: "2 วันก่อน" },
      { id: "LD-R04", name: "นาย อนันต์ ศ.",            province: "จันทบุรี",  product: "โกดังสำเร็จรูป", valueNum: 850000,  status: "won",       assignedAt: "2 สัปดาห์" },
    ],
    projects: [
      { id: "PRJ-R01", name: "โกดัง VCS Asia ระยอง",        product: "โรงงาน",  valueNum: 6200000, progress: 100, status: "completed",  dueDate: "28 ก.พ. 2569" },
      { id: "PRJ-R02", name: "โรงงาน บจ. แหลมฉบัง",         product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 3800000, progress: 62,  status: "in_progress", dueDate: "31 ส.ค. 2569" },
      { id: "PRJ-R03", name: "โกดัง มาบตาพุดโลหะ",           product: "โกดังสำเร็จรูป", valueNum: 1800000, progress: 38,  status: "in_progress", dueDate: "15 ก.ย. 2569" },
      { id: "PRJ-R04", name: "คลังสินค้า ชลบุรี เฟส 2",       product: "โรงงาน",  valueNum: 2400000, progress: 10,  status: "in_progress", dueDate: "30 ต.ค. 2569" },
      { id: "PRJ-R05", name: "โกดัง จันทบุรี อนันต์",         product: "โกดังสำเร็จรูป", valueNum: 850000,  progress: 0,   status: "in_progress", dueDate: "15 พ.ย. 2569" },
      { id: "PRJ-R06", name: "โรงงาน ตราด อุตสาหกรรม",        product: "โรงงาน",  valueNum: 3100000, progress: 0,   status: "in_progress", dueDate: "31 ธ.ค. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0091", customer: "หจก. ราชบุรีโลหะ",      product: "โรงงาน",  valueNum: 1800000, discountPct: 12, status: "sent_to_client", date: "3 ชม." },
      { quoteNo: "Q-2026-0086", customer: "บจ. แหลมฉบัง อุตฯ",     product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 3800000, discountPct: 8,  status: "sent_to_client",     date: "2 วัน" },
      { quoteNo: "Q-2026-0118", customer: "หจก. มาบตาพุดโลหะ",      product: "โกดังสำเร็จรูป", valueNum: 1800000, discountPct: 5,  status: "won",      date: "2 สัปดาห์" },
      { quoteNo: "Q-2026-0065", customer: "VCS Asia",                product: "โรงงาน",  valueNum: 6200000, discountPct: 0,  status: "won",      date: "4 สัปดาห์" },
    ],
  },
  CNX: {
    code: "CNX",
    monthlySales: [
      { month: "ม.ค.", value: 2100 }, { month: "ก.พ.", value: 1800 }, { month: "มี.ค.", value: 3200 },
      { month: "เม.ย.", value: 4100 }, { month: "พ.ค.", value: 2600 }, { month: "มิ.ย.", value: 4200 },
    ],
    leads: [
      { id: "LD-C01", name: "บจ. ไทยสตีล",          province: "เชียงใหม่",  product: "โกดังสำเร็จรูป", valueNum: 3200000, status: "quoted",    assignedAt: "5 วันก่อน" },
      { id: "LD-C02", name: "หจก. สันทรายเมทัล",  province: "เชียงใหม่",  product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 1200000, status: "contacted", assignedAt: "1 สัปดาห์" },
      { id: "LD-C03", name: "บจ. ลำพูนโลหะ",         province: "ลำพูน",      product: "โรงงาน",  valueNum: 2800000, status: "contacted", assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-C01", name: "โกดัง บจ. ไทยสตีล เชียงใหม่",  product: "โกดังสำเร็จรูป", valueNum: 3200000, progress: 45, status: "in_progress", dueDate: "31 ก.ค. 2569" },
      { id: "PRJ-C02", name: "โรงงาน อาคารสำเร็จรูป ซีซีเอส",          product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 3200000, progress: 72, status: "in_progress", dueDate: "15 ส.ค. 2569" },
      { id: "PRJ-C03", name: "คลังสินค้า ลำพูน อุตฯ",          product: "โรงงาน",  valueNum: 1600000, progress: 0,  status: "in_progress", dueDate: "30 ก.ย. 2569" },
      { id: "PRJ-C04", name: "โกดัง เชียงใหม่-ลำปาง",          product: "โกดังสำเร็จรูป", valueNum: 2100000, progress: 25, status: "on_hold",     dueDate: "31 ต.ค. 2569" },
      { id: "PRJ-C05", name: "โรงงาน น่าน (งานตามแบบ)",             product: "งานตามแบบของลูกค้า",    valueNum: 4800000, progress: 5,  status: "in_progress", dueDate: "28 ก.พ. 2570" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0089", customer: "บจ. ไทยสตีล",       product: "โกดังสำเร็จรูป", valueNum: 1800000, discountPct: 5,  status: "won", date: "6 สัปดาห์" },
      { quoteNo: "Q-2026-0083", customer: "หจก. สันทราย",       product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 1200000, discountPct: 6,  status: "sent_to_client",     date: "4 วัน" },
      { quoteNo: "Q-2026-0074", customer: "บจ. ลำพูนโลหะ",     product: "โรงงาน",  valueNum: 2800000, discountPct: 4,  status: "draft",    date: "1 สัปดาห์" },
    ],
  },
  MST: {
    code: "MST",
    monthlySales: [
      { month: "ม.ค.", value: 1800 }, { month: "ก.พ.", value: 2400 }, { month: "มี.ค.", value: 3100 },
      { month: "เม.ย.", value: 4200 }, { month: "พ.ค.", value: 3600 }, { month: "มิ.ย.", value: 3800 },
    ],
    leads: [
      { id: "LD-M01", name: "บจ. แม่สอดโลหะ",        province: "ตาก",    product: "โกดังสำเร็จรูป", valueNum: 4100000, status: "quoted",    assignedAt: "3 วันก่อน" },
      { id: "LD-M02", name: "หจก. กาญจน์อุตฯ",       province: "กาญจนบุรี", product: "โรงงาน", valueNum: 2200000, status: "contacted", assignedAt: "5 วันก่อน" },
      { id: "LD-M03", name: "นาย ธนกร ป.",            province: "ตาก",    product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 980000,  status: "contacted", assignedAt: "2 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-M01", name: "โกดังสำเร็จรูป แม่สอด บจ. แม่สอดโลหะ", product: "โกดังสำเร็จรูป", valueNum: 4100000, progress: 82, status: "in_progress", dueDate: "31 ก.ค. 2569" },
      { id: "PRJ-M02", name: "โกดัง โรงงานสำเร็จรูป กาญจนบุรี",         product: "โรงงาน",  valueNum: 2200000, progress: 55, status: "in_progress", dueDate: "30 ส.ค. 2569" },
      { id: "PRJ-M03", name: "โรงงาน อาคารสำเร็จรูป ตาก",                product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 1600000, progress: 30, status: "in_progress", dueDate: "30 ก.ย. 2569" },
      { id: "PRJ-M04", name: "คลังสินค้า ราชบุรี",               product: "โกดังสำเร็จรูป", valueNum: 1800000, progress: 0,  status: "in_progress", dueDate: "31 ต.ค. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0085", customer: "บจ. แม่สอดโลหะ", product: "โกดังสำเร็จรูป", valueNum: 4100000, discountPct: 7,  status: "won",  date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0080", customer: "หจก. กาญจน์อุตฯ", product: "โรงงาน",  valueNum: 2200000, discountPct: 5,  status: "sent_to_client", date: "2 สัปดาห์" },
      { quoteNo: "Q-2026-0077", customer: "นาย ธนกร ป.",     product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 980000,  discountPct: 3,  status: "draft", date: "2 สัปดาห์" },
    ],
  },
  CRI: {
    code: "CRI",
    monthlySales: [
      { month: "ม.ค.", value: 1200 }, { month: "ก.พ.", value: 900 }, { month: "มี.ค.", value: 2200 },
      { month: "เม.ย.", value: 3100 }, { month: "พ.ค.", value: 2800 }, { month: "มิ.ย.", value: 3100 },
    ],
    leads: [
      { id: "LD-CR01", name: "บจ. เชียงรายอุตสาหกรรม", province: "เชียงราย", product: "โรงงาน",  valueNum: 3600000, status: "quoted",    assignedAt: "4 วันก่อน" },
      { id: "LD-CR02", name: "หจก. พะเยาสตีล",    province: "พะเยา",    product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 1100000, status: "contacted", assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-CR01", name: "โรงงาน โรงงานสำเร็จรูป เชียงราย",     product: "โรงงาน",  valueNum: 3600000, progress: 40, status: "in_progress", dueDate: "30 ก.ย. 2569" },
      { id: "PRJ-CR02", name: "โกดัง โกดังสำเร็จรูป พะเยา",        product: "โกดังสำเร็จรูป", valueNum: 1800000, progress: 60, status: "in_progress", dueDate: "31 ส.ค. 2569" },
      { id: "PRJ-CR03", name: "อาคารสำเร็จรูป เชียงราย เฟส 1",        product: "อาคารสำเร็จรูปทุกประเภท",    valueNum: 2100000, progress: 15, status: "overdue",     dueDate: "15 มิ.ย. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0082", customer: "บจ. เชียงรายอุตฯ", product: "โรงงาน",  valueNum: 3600000, discountPct: 9,  status: "sent_to_client",  date: "3 วัน" },
      { quoteNo: "Q-2026-0075", customer: "หจก. พะเยาสตีล", product: "อาคารสำเร็จรูปทุกประเภท",  valueNum: 1100000, discountPct: 5,  status: "draft", date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0070", customer: "บจ. เชียงรายอุตฯ", product: "โกดังสำเร็จรูป", valueNum: 1800000, discountPct: 6,  status: "won",   date: "3 สัปดาห์" },
    ],
  },
  NSN: {
    code: "NSN",
    monthlySales: [
      { month: "ม.ค.", value: 5400 }, { month: "ก.พ.", value: 800 }, { month: "มี.ค.", value: 600 },
      { month: "เม.ย.", value: 400 }, { month: "พ.ค.", value: 500 }, { month: "มิ.ย.", value: 1900 },
    ],
    leads: [
      { id: "LD-N01", name: "บจ. นครสวรรค์โกดัง", province: "นครสวรรค์", product: "โกดังสำเร็จรูป", valueNum: 2400000, status: "contacted", assignedAt: "6 วันก่อน" },
      { id: "LD-N02", name: "หจก. สุโขทัยอุตฯ",  province: "สุโขทัย",   product: "โรงงาน",  valueNum: 1800000, status: "contacted", assignedAt: "2 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-N01", name: "โรงงาน โรงงานสำเร็จรูป นครสวรรค์",    product: "โรงงาน",  valueNum: 5400000, progress: 100, status: "completed",  dueDate: "31 มี.ค. 2569" },
      { id: "PRJ-N02", name: "โกดัง โกดังสำเร็จรูป นครสวรรค์",    product: "โกดังสำเร็จรูป", valueNum: 1900000, progress: 20,  status: "in_progress", dueDate: "31 ส.ค. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0117", customer: "บจ. นครสวรรค์โกดัง", product: "โกดังสำเร็จรูป", valueNum: 2400000, discountPct: 8, status: "sent_to_client", date: "4 วัน" },
      { quoteNo: "Q-2026-0072", customer: "หจก. สุโขทัยอุตฯ",    product: "โรงงาน",  valueNum: 1800000, discountPct: 5, status: "draft", date: "1 สัปดาห์" },
    ],
  },
  HYI: {
    code: "HYI",
    monthlySales: [
      { month: "ม.ค.", value: 300 }, { month: "ก.พ.", value: 220 }, { month: "มี.ค.", value: 150 },
      { month: "เม.ย.", value: 120 }, { month: "พ.ค.", value: 80 }, { month: "มิ.ย.", value: 50 },
    ],
    leads: [
      { id: "LD-H01", name: "บ.สงขลาแคนนิ่ง", province: "สงขลา", product: "โรงงาน", valueNum: 2600000, status: "contacted", assignedAt: "2 เดือนก่อน" },
    ],
    projects: [
      { id: "PRJ-H01", name: "โกดัง หาดใหญ่ เฟส 1", product: "โกดังสำเร็จรูป", valueNum: 920000, progress: 100, status: "completed", dueDate: "31 ม.ค. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0059", customer: "บ.สงขลาแคนนิ่ง", product: "โรงงาน", valueNum: 2600000, discountPct: 9, status: "lost", date: "2 เดือน" },
    ],
  },
  AYA: {
    code: "AYA",
    monthlySales: [
      { month: "ม.ค.", value: 3800 }, { month: "ก.พ.", value: 4200 }, { month: "มี.ค.", value: 5100 },
      { month: "เม.ย.", value: 4400 }, { month: "พ.ค.", value: 5300 }, { month: "มิ.ย.", value: 4650 },
    ],
    leads: [
      { id: "LD-A01", name: "บ.โรจนะอินดัสทรี",       province: "พระนครศรีอยุธยา", product: "โรงงาน",  valueNum: 6400000, status: "quoted",    assignedAt: "2 วันก่อน" },
      { id: "LD-A02", name: "หจก. บางปะอินโลจิสติกส์", province: "พระนครศรีอยุธยา", product: "โกดังสำเร็จรูป", valueNum: 2700000, status: "quoted",    assignedAt: "5 วันก่อน" },
      { id: "LD-A03", name: "บ.สระบุรีคอนกรีต",        province: "สระบุรี",          product: "งานตามแบบของลูกค้า",      valueNum: 3100000, status: "contacted", assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-A01", name: "โรงงาน วังน้อยฟู้ดส์",     product: "โรงงาน",  valueNum: 4100000, progress: 35, status: "in_progress", dueDate: "30 ก.ย. 2569" },
      { id: "PRJ-A02", name: "โกดัง นิคมโรจนะ B4",       product: "โกดังสำเร็จรูป", valueNum: 2800000, progress: 70, status: "in_progress", dueDate: "31 ส.ค. 2569" },
      { id: "PRJ-A03", name: "อาคารสำนักงาน อยุธยาพาร์ค", product: "อาคารสำเร็จรูปทุกประเภท",  valueNum: 1900000, progress: 100, status: "completed", dueDate: "30 เม.ย. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0093", customer: "บ.โรจนะอินดัสทรี",        product: "โรงงาน",  valueNum: 6400000, discountPct: 5, status: "sent_to_client", date: "4 วัน" },
      { quoteNo: "Q-2026-0090", customer: "หจก. บางปะอินโลจิสติกส์", product: "โกดังสำเร็จรูป", valueNum: 2700000, discountPct: 8, status: "viewed", date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0084", customer: "บ.วังน้อยฟู้ดส์",          product: "โรงงาน",  valueNum: 4100000, discountPct: 4, status: "won",   date: "3 สัปดาห์" },
    ],
  },
  KKN: {
    code: "KKN",
    monthlySales: [
      { month: "ม.ค.", value: 2600 }, { month: "ก.พ.", value: 3100 }, { month: "มี.ค.", value: 2900 },
      { month: "เม.ย.", value: 3600 }, { month: "พ.ค.", value: 3200 }, { month: "มิ.ย.", value: 3450 },
    ],
    leads: [
      { id: "LD-K01", name: "บ.อีสานแดรี่",        province: "ขอนแก่น",   product: "โรงงาน",  valueNum: 3900000, status: "quoted",    assignedAt: "3 วันก่อน" },
      { id: "LD-K02", name: "เทศบาลนครขอนแก่น",   province: "ขอนแก่น",   product: "อาคารสำเร็จรูปทุกประเภท",   valueNum: 1750000, status: "quoted",    assignedAt: "1 สัปดาห์" },
      { id: "LD-K03", name: "หจก. ชุมแพเกษตรภัณฑ์", province: "ขอนแก่น",   product: "โกดังสำเร็จรูป", valueNum: 1300000, status: "contacted", assignedAt: "2 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-K01", name: "โกดัง สหกรณ์โคนมขอนแก่น",  product: "โกดังสำเร็จรูป", valueNum: 2150000, progress: 55, status: "in_progress", dueDate: "30 ก.ย. 2569" },
      { id: "PRJ-K02", name: "โรงงาน อีสานแดรี่ เฟส 1",    product: "โรงงาน",  valueNum: 3900000, progress: 10, status: "in_progress", dueDate: "31 ธ.ค. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0088", customer: "บ.อีสานแดรี่",       product: "โรงงาน",  valueNum: 3900000, discountPct: 6, status: "sent_to_client", date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0081", customer: "สหกรณ์โคนมขอนแก่น", product: "โกดังสำเร็จรูป", valueNum: 2150000, discountPct: 5, status: "won",   date: "4 สัปดาห์" },
    ],
  },
  UBN: {
    code: "UBN",
    monthlySales: [
      { month: "ม.ค.", value: 1900 }, { month: "ก.พ.", value: 2300 }, { month: "มี.ค.", value: 2100 },
      { month: "เม.ย.", value: 2600 }, { month: "พ.ค.", value: 2400 }, { month: "มิ.ย.", value: 2750 },
    ],
    leads: [
      { id: "LD-U01", name: "บ.อุบลไรซ์มิลล์",  province: "อุบลราชธานี", product: "โกดังสำเร็จรูป", valueNum: 2900000, status: "quoted",    assignedAt: "4 วันก่อน" },
      { id: "LD-U02", name: "หจก. เดชอุดมค้าวัสดุ", province: "อุบลราชธานี", product: "อาคารสำเร็จรูปทุกประเภท",  valueNum: 950000,  status: "contacted", assignedAt: "1 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-U01", name: "โกดังข้าว วารินฟาร์ม",   product: "โกดังสำเร็จรูป", valueNum: 1450000, progress: 80, status: "in_progress", dueDate: "31 ก.ค. 2569" },
      { id: "PRJ-U02", name: "โกดัง อุบลไรซ์มิลล์",     product: "โกดังสำเร็จรูป", valueNum: 2900000, progress: 0,  status: "in_progress", dueDate: "30 พ.ย. 2569" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0087", customer: "บ.อุบลไรซ์มิลล์",     product: "โกดังสำเร็จรูป", valueNum: 2900000, discountPct: 7,  status: "sent_to_client", date: "2 สัปดาห์" },
      { quoteNo: "Q-2026-0076", customer: "หจก. วารินฟาร์ม",     product: "โกดังสำเร็จรูป", valueNum: 1450000, discountPct: 3,  status: "won",  date: "5 สัปดาห์" },
      { quoteNo: "Q-2026-0066", customer: "บ.ศรีสะเกษวัสดุภัณฑ์",  product: "งานตามแบบของลูกค้า",     valueNum: 2300000, discountPct: 10, status: "lost", date: "2 เดือน" },
    ],
  },
  PKT: {
    code: "PKT",
    monthlySales: [
      { month: "ม.ค.", value: 1500 }, { month: "ก.พ.", value: 1800 }, { month: "มี.ค.", value: 2200 },
      { month: "เม.ย.", value: 1900 }, { month: "พ.ค.", value: 2100 }, { month: "มิ.ย.", value: 2300 },
    ],
    leads: [
      { id: "LD-P01", name: "บ.อันดามันมารีน่า",     province: "ภูเก็ต", product: "งานตามแบบของลูกค้า",      valueNum: 5200000, status: "quoted",    assignedAt: "2 วันก่อน" },
      { id: "LD-P02", name: "บ.กะตะบีชรีสอร์ท",      province: "ภูเก็ต", product: "อาคารสำเร็จรูปทุกประเภท",  valueNum: 2800000, status: "contacted", assignedAt: "6 วันก่อน" },
    ],
    projects: [
      { id: "PRJ-P01", name: "คลังสินค้า ถลางแวร์เฮาส์", product: "โกดังสำเร็จรูป", valueNum: 1850000, progress: 45, status: "in_progress", dueDate: "31 ต.ค. 2569" },
      { id: "PRJ-P02", name: "โครงหลังคา มารีน่าคลับ",    product: "งานตามแบบของลูกค้า",     valueNum: 3200000, progress: 20, status: "in_progress", dueDate: "31 ม.ค. 2570" },
    ],
    quotes: [
      { quoteNo: "Q-2026-0094", customer: "บ.อันดามันมารีน่า",    product: "งานตามแบบของลูกค้า",      valueNum: 5200000, discountPct: 6,  status: "sent_to_client", date: "1 สัปดาห์" },
      { quoteNo: "Q-2026-0079", customer: "หจก. ถลางแวร์เฮาส์",   product: "โกดังสำเร็จรูป", valueNum: 1850000, discountPct: 4,  status: "won",     date: "5 สัปดาห์" },
      { quoteNo: "Q-2026-0060", customer: "บ.ภูเก็ตรีสอร์ทกรุ๊ป", product: "อาคารสำเร็จรูปทุกประเภท",  valueNum: 3400000, discountPct: 12, status: "expired", date: "2 เดือน" },
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
  { key: "contacted",   label: "ติดต่อแล้ว",         count: 42, valueNum: 94200000, color: "#8fa3c0" },
  { key: "requirement", label: "รวบรวมความต้องการ", count: 28, valueNum: 62400000, color: "#5b7fa6" },
  { key: "quoted",      label: "เสนอราคา",          count: 16, valueNum: 38600000, color: "#4d7aa8" },
  { key: "negotiation", label: "เจรจาต่อรอง",       count: 9,  valueNum: 22100000, color: "#1a5b8f" },
  { key: "won",         label: "ปิดการขาย",         count: 5,  valueNum: 14300000, color: "#003366" },
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
  { product: "โรงงาน",   count: 14, valueNum: 32400000, color: "#003366" },
  { product: "โกดังสำเร็จรูป",  count: 12, valueNum: 24600000, color: "#0a4f8c" },
  { product: "งานตามแบบของลูกค้า",     count: 8,  valueNum: 18900000, color: "#1e6fbf" },
  { product: "อาคารสำเร็จรูปทุกประเภท",     count: 5,  valueNum: 11200000, color: "#8fa3b8" },
  { product: "งานรีโนเวท",    count: 2,  valueNum: 5800000,  color: "#82b4e3" },
  { product: "สนามกีฬาในร่ม", count: 1,  valueNum: 1300000,  color: "#b8d4f0" },
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
  { id:1,  name:"บ.อุตสาหกรรมไทย จก.",        dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"บริษัท",        province:"ระยอง",       dealsWon:2, totalRevenue:7400000,  status:"active",   lastContact:"23 มิ.ย. 2569", segment:"enterprise" },
  { id:2,  name:"บ.เอบีซี แมนูแฟคเจอริ่ง",    dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"บริษัท",        province:"ชลบุรี",      dealsWon:1, totalRevenue:2800000,  status:"active",   lastContact:"18 มิ.ย. 2569", segment:"enterprise" },
  { id:3,  name:"หจก. ไอซ์โลจิสติกส์",         dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"หจก.",          province:"ระยอง",       dealsWon:3, totalRevenue:9200000,  status:"active",   lastContact:"10 มิ.ย. 2569", segment:"sme" },
  { id:4,  name:"บ.พีซีบี คอนสตรัคชั่น",       dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"บริษัท",        province:"ชลบุรี",      dealsWon:1, totalRevenue:3500000,  status:"active",   lastContact:"15 มิ.ย. 2569", segment:"sme" },
  { id:5,  name:"บ.ปิโตรเคม (ไทย)",            dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"บริษัท",        province:"ระยอง",       dealsWon:1, totalRevenue:5100000,  status:"active",   lastContact:"5 มิ.ย. 2569",  segment:"enterprise" },
  { id:6,  name:"สหกรณ์ลำพูน จก.",             dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"หจก.",          province:"ลำพูน",       dealsWon:2, totalRevenue:3600000,  status:"active",   lastContact:"20 มิ.ย. 2569", segment:"sme" },
  { id:7,  name:"อบจ.เชียงใหม่",               dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"หน่วยงานรัฐ",   province:"เชียงใหม่",   dealsWon:1, totalRevenue:4600000,  status:"active",   lastContact:"22 มิ.ย. 2569", segment:"government" },
  { id:8,  name:"บ.ซีเอ็นเอ็กซ์ ฟูด",         dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"บริษัท",        province:"เชียงใหม่",   dealsWon:1, totalRevenue:3800000,  status:"active",   lastContact:"12 มิ.ย. 2569", segment:"sme" },
  { id:9,  name:"กลุ่มเกษตรลำพูน",             dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"บุคคล",         province:"ลำพูน",       dealsWon:1, totalRevenue:2900000,  status:"inactive", lastContact:"2 มิ.ย. 2569",  segment:"sme" },
  { id:10, name:"บ.ทีดีเค ลอจิสติกส์",         dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",    type:"บริษัท",        province:"ตาก",         dealsWon:2, totalRevenue:8100000,  status:"active",   lastContact:"21 มิ.ย. 2569", segment:"enterprise" },
  { id:11, name:"หจก. แม่สอดพาณิชย์",          dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",    type:"หจก.",          province:"ตาก",         dealsWon:2, totalRevenue:4200000,  status:"active",   lastContact:"18 มิ.ย. 2569", segment:"sme" },
  { id:12, name:"บ.เฟรชโลจิส",                 dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",    type:"บริษัท",        province:"ตาก",         dealsWon:1, totalRevenue:3200000,  status:"active",   lastContact:"15 มิ.ย. 2569", segment:"sme" },
  { id:13, name:"วิสาหกิจชุมชนดอยอินทนนท์",   dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  type:"บุคคล",         province:"เชียงราย",    dealsWon:1, totalRevenue:3100000,  status:"active",   lastContact:"20 มิ.ย. 2569", segment:"sme" },
  { id:14, name:"บ.โกลเด้น ทรี โลจิส",         dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  type:"บริษัท",        province:"เชียงราย",    dealsWon:2, totalRevenue:4500000,  status:"active",   lastContact:"18 มิ.ย. 2569", segment:"sme" },
  { id:15, name:"ม.ราชภัฏเชียงราย",            dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  type:"หน่วยงานรัฐ",   province:"เชียงราย",    dealsWon:1, totalRevenue:4900000,  status:"inactive", lastContact:"5 มิ.ย. 2569",  segment:"government" },
  { id:16, name:"สหกรณ์การเกษตรนครสวรรค์",    dealerCode:"NSN", dealerName:"นครสวรรค์เอ็นจิเนียริ่ง", type:"หจก.",          province:"นครสวรรค์",   dealsWon:1, totalRevenue:1600000,  status:"active",   lastContact:"10 มิ.ย. 2569", segment:"sme" },
  { id:17, name:"เทศบาลเมืองนครสวรรค์",        dealerCode:"NSN", dealerName:"นครสวรรค์เอ็นจิเนียริ่ง", type:"หน่วยงานรัฐ",   province:"นครสวรรค์",   dealsWon:1, totalRevenue:900000,   status:"active",   lastContact:"24 มิ.ย. 2569", segment:"government" },
  { id:18, name:"บ.ระยองยานยนต์",              dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"บริษัท",        province:"ระยอง",       dealsWon:1, totalRevenue:3300000,  status:"active",   lastContact:"8 มิ.ย. 2569",  segment:"sme" },
  { id:19, name:"บ.ไทยสตีล",                   dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"บริษัท",        province:"เชียงใหม่",   dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"25 มิ.ย. 2569", segment:"enterprise" },
  { id:20, name:"หจก. ราชบุรีโลหะ",            dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     type:"หจก.",          province:"ราชบุรี",     dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"24 มิ.ย. 2569", segment:"sme" },
  { id:21, name:"บ.โรจนะอินดัสทรี",            dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   type:"บริษัท",        province:"พระนครศรีอยุธยา", dealsWon:0, totalRevenue:0,       status:"active",   lastContact:"26 มิ.ย. 2569", segment:"enterprise" },
  { id:22, name:"บ.วังน้อยฟู้ดส์",              dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   type:"บริษัท",        province:"พระนครศรีอยุธยา", dealsWon:1, totalRevenue:4100000, status:"active",   lastContact:"9 มิ.ย. 2569",  segment:"sme" },
  { id:23, name:"หจก. บางปะอินโลจิสติกส์",      dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   type:"หจก.",          province:"พระนครศรีอยุธยา", dealsWon:0, totalRevenue:0,       status:"active",   lastContact:"23 มิ.ย. 2569", segment:"sme" },
  { id:24, name:"บ.อีสานแดรี่",                 dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  type:"บริษัท",        province:"ขอนแก่น",     dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"21 มิ.ย. 2569", segment:"enterprise" },
  { id:25, name:"สหกรณ์โคนมขอนแก่น",           dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  type:"หจก.",          province:"ขอนแก่น",     dealsWon:1, totalRevenue:2150000,  status:"active",   lastContact:"4 มิ.ย. 2569",  segment:"sme" },
  { id:26, name:"เทศบาลนครขอนแก่น",            dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  type:"หน่วยงานรัฐ",   province:"ขอนแก่น",     dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"16 พ.ค. 2569", segment:"government" },
  { id:27, name:"บ.อุบลไรซ์มิลล์",              dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      type:"บริษัท",        province:"อุบลราชธานี", dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"19 มิ.ย. 2569", segment:"sme" },
  { id:28, name:"หจก. วารินฟาร์ม",              dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      type:"หจก.",          province:"อุบลราชธานี", dealsWon:1, totalRevenue:1450000,  status:"active",   lastContact:"27 พ.ค. 2569", segment:"sme" },
  { id:29, name:"บ.ศรีสะเกษวัสดุภัณฑ์",           dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      type:"บริษัท",        province:"ศรีสะเกษ",    dealsWon:0, totalRevenue:0,        status:"inactive", lastContact:"7 พ.ค. 2569",  segment:"sme" },
  { id:30, name:"บ.อันดามันมารีน่า",            dealerCode:"PKT", dealerName:"ภูเก็ตสตรัคเจอรัล", type:"บริษัท",        province:"ภูเก็ต",      dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"27 มิ.ย. 2569", segment:"enterprise" },
  { id:31, name:"หจก. ถลางแวร์เฮาส์",           dealerCode:"PKT", dealerName:"ภูเก็ตสตรัคเจอรัล", type:"หจก.",          province:"ภูเก็ต",      dealsWon:1, totalRevenue:1850000,  status:"active",   lastContact:"31 พ.ค. 2569", segment:"sme" },
  { id:32, name:"บ.สงขลาแคนนิ่ง",               dealerCode:"HYI", dealerName:"หาดใหญ่สตีลกรุ๊ป",  type:"บริษัท",        province:"สงขลา",       dealsWon:0, totalRevenue:0,        status:"inactive", lastContact:"22 เม.ย. 2569", segment:"sme" },
  { id:33, name:"บ.มาบตาพุดเคมิคอล",           dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",  type:"บริษัท",        province:"ระยอง",       dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"27 มิ.ย. 2569", segment:"enterprise" },
  { id:34, name:"บ.นอร์ทเทิร์นฟาร์ม",           dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", type:"บริษัท",        province:"เชียงใหม่",   dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"12 พ.ค. 2569", segment:"sme" },
  { id:35, name:"บ.ชายแดนเทรดดิ้ง",             dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",  type:"บริษัท",        province:"ตาก",         dealsWon:0, totalRevenue:0,        status:"active",   lastContact:"7 มิ.ย. 2569",  segment:"sme" },
  { id:36, name:"หจก. น้ำพองวัสดุ",             dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  type:"หจก.",          province:"ขอนแก่น",     dealsWon:1, totalRevenue:1250000,  status:"active",   lastContact:"2 พ.ค. 2569",  segment:"sme" },
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
  status: QuotationStatus;
  createdAt: string;
  salesperson: string;
  productLine: string;
};

export const hqAllQuotations: HQQuotation[] = [
  { id:"HQ-Q01", quoteNo:"Q-2026-0089", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"บจ. ไทยสตีล",            valueNum:1800000, discountPct:5,  status:"won"          , createdAt:"15 พ.ค. 2569", salesperson:"วิภา ป.",      productLine:"โกดังสำเร็จรูป"  },
  { id:"HQ-Q02", quoteNo:"Q-2026-0091", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"หจก. ราชบุรีโลหะ",       valueNum:760000,  discountPct:0,  status:"sent_to_client"          , createdAt:"1 มิ.ย. 2569",  salesperson:"วิภา ป.",     productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q03", quoteNo:"Q-2026-0085", dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     customer:"บ.อุตสาหกรรมไทย จก.",    valueNum:4200000, discountPct:5,  status:"won",              createdAt:"10 มิ.ย. 2569", salesperson:"สมชาย ว.",     productLine:"โรงงาน"  },
  { id:"HQ-Q04", quoteNo:"Q-2026-0086", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"สหกรณ์ลำพูน จก.",        valueNum:2200000, discountPct:7,  status:"won",              createdAt:"8 มิ.ย. 2569",  salesperson:"วิภา ป.",      productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q05", quoteNo:"Q-2026-0082", dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",    customer:"บ.ทีดีเค ลอจิสติกส์",    valueNum:5800000, discountPct:4,  status:"sent_to_client",             createdAt:"5 มิ.ย. 2569",  salesperson:"อนันต์ ส.",    productLine:"โรงงาน"  },
  { id:"HQ-Q06", quoteNo:"Q-2026-0080", dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  customer:"วิสาหกิจชุมชนดอยอินทนนท์",valueNum:3100000, discountPct:6,  status:"sent_to_client",             createdAt:"3 มิ.ย. 2569",  salesperson:"เกรียงไกร จ.", productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q07", quoteNo:"Q-2026-0078", dealerCode:"NSN", dealerName:"นครสวรรค์เอ็นจิเนียริ่ง", customer:"สหกรณ์การเกษตรนครสวรรค์",valueNum:1600000, discountPct:3,  status:"won",              createdAt:"1 มิ.ย. 2569",  salesperson:"ธีรพล อ.",    productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q08", quoteNo:"Q-2026-0077", dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  customer:"บ.โกลเด้น ทรี โลจิส",    valueNum:2400000, discountPct:8,  status:"won",              createdAt:"28 พ.ค. 2569",  salesperson:"เกรียงไกร จ.", productLine:"โรงงาน"  },
  { id:"HQ-Q09", quoteNo:"Q-2026-0075", dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     customer:"บ.ปิโตรเคม (ไทย)",       valueNum:5100000, discountPct:5,  status:"won",              createdAt:"25 พ.ค. 2569",  salesperson:"สมชาย ว.",     productLine:"โรงงาน"  },
  { id:"HQ-Q10", quoteNo:"Q-2026-0073", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"บ.ซีเอ็นเอ็กซ์ ฟูด",    valueNum:3800000, discountPct:6,  status:"sent_to_client",             createdAt:"20 พ.ค. 2569",  salesperson:"สุรชัย ท.",    productLine:"โรงงาน"  },
  { id:"HQ-Q11", quoteNo:"Q-2026-0070", dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",    customer:"หจก. แม่สอดพาณิชย์",    valueNum:2100000, discountPct:5,  status:"won",              createdAt:"15 พ.ค. 2569",  salesperson:"อนันต์ ส.",    productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q12", quoteNo:"Q-2026-0068", dealerCode:"HYI", dealerName:"หาดใหญ่สตีลกรุ๊ป",  customer:"บ.หาดใหญ่อุตสาหกรรม",   valueNum:480000,  discountPct:0,  status:"draft",            createdAt:"10 พ.ค. 2569",  salesperson:"พิมพ์ ท.",     productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q13", quoteNo:"Q-2026-0065", dealerCode:"NSN", dealerName:"นครสวรรค์เอ็นจิเนียริ่ง", customer:"เทศบาลเมืองนครสวรรค์",  valueNum:900000,  discountPct:0,  status:"sent_to_client",             createdAt:"5 พ.ค. 2569",   salesperson:"ธีรพล อ.",    productLine:"อาคารสำเร็จรูปทุกประเภท"    },
  { id:"HQ-Q14", quoteNo:"Q-2026-0062", dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     customer:"บ.เอสทีพี โฮลดิ้ง",     valueNum:1900000, discountPct:4,  status:"won",              createdAt:"1 พ.ค. 2569",   salesperson:"ประภาส ร.",    productLine:"อาคารสำเร็จรูปทุกประเภท"    },
  { id:"HQ-Q15", quoteNo:"Q-2026-0058", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"กลุ่มเกษตรลำพูน",       valueNum:2900000, discountPct:9,  status:"lost",             createdAt:"20 เม.ย. 2569", salesperson:"วิภา ป.",      productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q16", quoteNo:"Q-2026-0055", dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์",  customer:"ม.ราชภัฏเชียงราย",       valueNum:4900000, discountPct:7,  status:"draft",            createdAt:"15 เม.ย. 2569", salesperson:"สุชาติ ม.",    productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q17", quoteNo:"Q-2026-0111", dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",     customer:"บ.ระยองยานยนต์",         valueNum:3300000, discountPct:6,  status:"sent_to_client",             createdAt:"25 มิ.ย. 2569", salesperson:"สมชาย ว.",     productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q18", quoteNo:"Q-2026-0093", dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   customer:"บ.โรจนะอินดัสทรี",        valueNum:6400000, discountPct:5,  status:"sent_to_client",  createdAt:"26 มิ.ย. 2569", salesperson:"กมล พ.",       productLine:"โรงงาน"  },
  { id:"HQ-Q19", quoteNo:"Q-2026-0090", dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   customer:"หจก. บางปะอินโลจิสติกส์",  valueNum:2700000, discountPct:8,  status:"viewed",          createdAt:"23 มิ.ย. 2569", salesperson:"กมล พ.",       productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q20", quoteNo:"Q-2026-0084", dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   customer:"บ.วังน้อยฟู้ดส์",          valueNum:4100000, discountPct:4,  status:"won",             createdAt:"9 มิ.ย. 2569",  salesperson:"อรทัย บ.",     productLine:"โรงงาน"  },
  { id:"HQ-Q21", quoteNo:"Q-2026-0088", dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  customer:"บ.อีสานแดรี่",             valueNum:3900000, discountPct:6,  status:"sent_to_client",  createdAt:"21 มิ.ย. 2569", salesperson:"ชูชัย ก.",     productLine:"โรงงาน"  },
  { id:"HQ-Q22", quoteNo:"Q-2026-0081", dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  customer:"สหกรณ์โคนมขอนแก่น",       valueNum:2150000, discountPct:5,  status:"won",             createdAt:"4 มิ.ย. 2569",  salesperson:"ชูชัย ก.",     productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q23", quoteNo:"Q-2026-0071", dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  customer:"เทศบาลนครขอนแก่น",        valueNum:1750000, discountPct:0,  status:"viewed",          createdAt:"16 พ.ค. 2569",  salesperson:"มณีรัตน์ ศ.",  productLine:"อาคารสำเร็จรูปทุกประเภท"    },
  { id:"HQ-Q24", quoteNo:"Q-2026-0087", dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      customer:"บ.อุบลไรซ์มิลล์",          valueNum:2900000, discountPct:7,  status:"sent_to_client",  createdAt:"19 มิ.ย. 2569", salesperson:"ประวิทย์ ห.",  productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q25", quoteNo:"Q-2026-0076", dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      customer:"หจก. วารินฟาร์ม",          valueNum:1450000, discountPct:3,  status:"won",             createdAt:"27 พ.ค. 2569",  salesperson:"ประวิทย์ ห.",  productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q26", quoteNo:"Q-2026-0066", dealerCode:"UBN", dealerName:"อุบลสตีลกรุ๊ป",      customer:"บ.ศรีสะเกษวัสดุภัณฑ์",       valueNum:2300000, discountPct:10, status:"lost",            createdAt:"7 พ.ค. 2569",   salesperson:"ประวิทย์ ห.",  productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q27", quoteNo:"Q-2026-0094", dealerCode:"PKT", dealerName:"ภูเก็ตสตรัคเจอรัล", customer:"บ.อันดามันมารีน่า",        valueNum:5200000, discountPct:6,  status:"sent_to_client",  createdAt:"27 มิ.ย. 2569", salesperson:"ศิริพร ณ.",    productLine:"งานตามแบบของลูกค้า"    },
  { id:"HQ-Q28", quoteNo:"Q-2026-0079", dealerCode:"PKT", dealerName:"ภูเก็ตสตรัคเจอรัล", customer:"หจก. ถลางแวร์เฮาส์",       valueNum:1850000, discountPct:4,  status:"won",             createdAt:"31 พ.ค. 2569",  salesperson:"ศิริพร ณ.",    productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q29", quoteNo:"Q-2026-0060", dealerCode:"PKT", dealerName:"ภูเก็ตสตรัคเจอรัล", customer:"บ.ภูเก็ตรีสอร์ทกรุ๊ป",     valueNum:3400000, discountPct:12, status:"expired",         createdAt:"25 เม.ย. 2569", salesperson:"ศิริพร ณ.",    productLine:"อาคารสำเร็จรูปทุกประเภท"    },
  { id:"HQ-Q30", quoteNo:"Q-2026-0059", dealerCode:"HYI", dealerName:"หาดใหญ่สตีลกรุ๊ป",  customer:"บ.สงขลาแคนนิ่ง",           valueNum:2600000, discountPct:9,  status:"lost",            createdAt:"22 เม.ย. 2569", salesperson:"พิมพ์ ท.",     productLine:"โรงงาน"  },
  { id:"HQ-Q31", quoteNo:"Q-2026-0112", dealerCode:"RYG", dealerName:"ระยองสตีลเวิร์คส์",  customer:"บ.มาบตาพุดเคมิคอล",    valueNum:7200000, discountPct:3,  status:"viewed",          createdAt:"27 มิ.ย. 2569", salesperson:"สมชาย ว.",   productLine:"โรงงาน"  },
  { id:"HQ-Q32", quoteNo:"Q-2026-0069", dealerCode:"CNX", dealerName:"เชียงใหม่สตีลบิลด์", customer:"บ.นอร์ทเทิร์นฟาร์ม",   valueNum:2500000, discountPct:6,  status:"expired",         createdAt:"12 พ.ค. 2569",  salesperson:"วิภา ป.",     productLine:"โกดังสำเร็จรูป" },
  { id:"HQ-Q33", quoteNo:"Q-2026-0083", dealerCode:"MST", dealerName:"แม่สอดเมทัลเวิร์ค",  customer:"บ.ชายแดนเทรดดิ้ง",     valueNum:1900000, discountPct:4,  status:"viewed",          createdAt:"7 มิ.ย. 2569",  salesperson:"อนันต์ ส.",   productLine:"อาคารสำเร็จรูปทุกประเภท"    },
  { id:"HQ-Q34", quoteNo:"Q-2026-0074", dealerCode:"CRI", dealerName:"เชียงรายสตรัคเจอร์", customer:"บ.แม่สายอิมปอร์ต",     valueNum:3300000, discountPct:8,  status:"lost",            createdAt:"20 พ.ค. 2569",  salesperson:"เกรียงไกร จ.", productLine:"โรงงาน"  },
  { id:"HQ-Q35", quoteNo:"Q-2026-0113", dealerCode:"AYA", dealerName:"อยุธยาเมทัลบิลด์",   customer:"บ.บ้านแพนอุตสาหกรรม",  valueNum:5600000, discountPct:5,  status:"draft",           createdAt:"28 มิ.ย. 2569", salesperson:"อรทัย บ.",    productLine:"โรงงาน"  },
  { id:"HQ-Q36", quoteNo:"Q-2026-0064", dealerCode:"KKN", dealerName:"ขอนแก่นโครงเหล็ก",  customer:"หจก. น้ำพองวัสดุ",      valueNum:1250000, discountPct:2,  status:"won",             createdAt:"2 พ.ค. 2569",   salesperson:"มณีรัตน์ ศ.",  productLine:"โกดังสำเร็จรูป" },
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

export type DealStage = { id: number; name: string; color: string };

export const pipelineStages: DealStage[] = [
  { id: 2, name: "ติดต่อแล้ว",           color: "#475569" },
  { id: 4, name: "รวบรวมความต้องการ",   color: "#003366" },
  { id: 5, name: "เสนอราคา",            color: "#4338ca" },
  { id: 9, name: "ติดตามผล",            color: "#d97706" },
  { id: 6, name: "เจรจาต่อรอง",         color: "#b45309" },
  { id: 7, name: "ปิดการขาย",           color: "#059669" },
  { id: 8, name: "ไม่ได้งาน",           color: "#dc2626" },
];

export const pipelineDeals: PipelineDealMock[] = [
  // ── ตัวแทน เชียงใหม่สตีลบิลด์ ──
  {
    id: 1, customerId: 3, customer: "หจก. ราชบุรีโลหะ", project: "โกดังสำเร็จรูป ราชบุรี",
    value: 760000, stageId: 2, assigned: "วิภา", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 2800000, stageId: 4, assigned: "วิภา", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 4100000, stageId: 4, assigned: "สมชาย", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 3200000, stageId: 5, assigned: "กาญจนา", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 2000000, stageId: 6, assigned: "สมชาย", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 1800000, stageId: 6, assigned: "วิชัย", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
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
    value: 6200000, stageId: 7, assigned: "วิชัย", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
    outcome: "won", createdAt: "2025-11-10", files: [], tasks: [],
  },
  {
    id: 8, customerId: 8, customer: "บจ. นครสวรรค์โลหะ", project: "โรงงานสำเร็จรูป นครสวรรค์",
    value: 5400000, stageId: 7, assigned: "สมชาย", dealer: "เชียงใหม่สตีลบิลด์", dealerColor: "#003366",
    outcome: "won", createdAt: "2026-04-05", files: [], tasks: [],
  },
  // ── ตัวแทน นนทบุรีเมทัลเวิร์ค ──
  {
    id: 9, customerId: 0, customer: "บจ. ไทยสตีล", project: "อาคารสำเร็จรูป เฟส 2 นนทบุรี",
    value: 3500000, stageId: 2, assigned: "ปรีดา", dealer: "นนทบุรีเมทัลเวิร์ค", dealerColor: "#f59e0b",
    outcome: "active", createdAt: "2026-06-18",
    files: [],
    tasks: [
      { id: 30, text: "ส่งเอกสารข้อเสนอ",  done: true  },
      { id: 31, text: "นัดประชุมลูกค้า",       done: false },
    ],
  },
  {
    id: 10, customerId: 0, customer: "บจ. ซีซีเอส", project: "อาคารสำเร็จรูป นนทบุรี",
    value: 5800000, stageId: 5, assigned: "สายชล", dealer: "นนทบุรีเมทัลเวิร์ค", dealerColor: "#f59e0b",
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
    id: 11, customerId: 0, customer: "VCS Asia Co., Ltd.", project: "คลังสินค้า นนทบุรี",
    value: 9200000, stageId: 6, assigned: "ปรีดา", dealer: "นนทบุรีเมทัลเวิร์ค", dealerColor: "#f59e0b",
    outcome: "active", createdAt: "2026-04-20",
    files: [{ name: "contract_VCS_NTB.pdf", size: "2.3MB" }],
    tasks: [
      { id: 36, text: "เจรจาเงื่อนไข",        done: true },
      { id: 37, text: "ปรับ scope งาน",        done: true },
      { id: 38, text: "เซ็นสัญญา",            done: false },
    ],
  },
  // ── ตัวแทน ระยองสตีลเวิร์คส์ ──
  {
    id: 12, customerId: 0, customer: "บจ. สมุทรโกดัง", project: "อาคารสำเร็จรูป ระยองตะวันออก",
    value: 4400000, stageId: 4, assigned: "มานิตย์", dealer: "ระยองสตีลเวิร์คส์", dealerColor: "#22c55e",
    outcome: "active", createdAt: "2026-06-08",
    files: [{ name: "layout_Rayong.dwg", size: "6.1MB" }],
    tasks: [
      { id: 40, text: "นำเสนอโซลูชัน",             done: true  },
      { id: 41, text: "เยี่ยมชมสถานที่ลูกค้า",        done: true  },
      { id: 42, text: "สรุปความต้องการและข้อกำหนด",   done: false },
    ],
  },
  {
    id: 13, customerId: 0, customer: "หจก. ราชบุรีโลหะ", project: "คลังสินค้าเขต EEC",
    value: 7100000, stageId: 7, assigned: "มานิตย์", dealer: "ระยองสตีลเวิร์คส์", dealerColor: "#22c55e",
    outcome: "won", createdAt: "2026-03-10",
    files: [{ name: "signed_eec.pdf", size: "1.9MB" }],
    tasks: [
      { id: 43, text: "เซ็นสัญญา", done: true },
      { id: 44, text: "รับมัดจำ",  done: true },
    ],
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
    content: "โทรคุยกับคุณสมชาย เรื่องความคืบหน้าการขายโกดัง\n- ลูกค้าพอใจกับความคืบหน้า 65%\n- ขอให้ส่งรายงานรายสัปดาห์\n- จะนัดติดตามโอกาสการขายวันที่ 5 ก.ค. 2569",
    customerId: 1, customerName: "บจ. ไทยสตีล",
    author: "สมชาย", createdAt: "2026-06-20 14:30", updatedAt: "2026-06-20 14:30", color: "#003366",
  },
  {
    id: 2, title: "ประชุมทีมขาย ประจำสัปดาห์", category: "ประชุม", pinned: true,
    content: "ประชุมวันจันทร์ที่ 23 มิ.ย. 2569\n\nสรุปประเด็น:\n1. โอกาสการขายรวม ฿14.6M (กำลังดำเนินการ 6 รายการ)\n2. เป้าหมาย Q2 ต้องปิด 2 deals เพิ่ม\n3. ผู้สนใจรายใหม่จาก นิคมฯ อมตะ 3 ราย\n\nAction items:\n- วิภา: follow up บจ. อุตรดิตถ์โลหะ ภายใน 3 วัน\n- วิชัย: นำเสนอ spec ให้ VCS Asia รอบ 2",
    author: "กาญจนา", createdAt: "2026-06-23 10:00", updatedAt: "2026-06-23 10:45", color: "#15803d",
  },
  {
    id: 3, title: "ข้อเสนอพิเศษ บจ. ซีซีเอส", category: "โอกาสการขาย", pinned: false,
    content: "ลูกค้าขอส่วนลดเพิ่ม 5% สำหรับโอกาสการขาย อาคารสำเร็จรูป เชียงใหม่\n\nพิจารณา:\n- มูลค่าโอกาสการขาย ฿3.2M\n- ส่วนลด 5% = ฿160,000\n- อัตรากำไรยังคุ้มอยู่ถ้าได้ออเดอร์ครั้งถัดไป\n\nตัดสินใจ: อนุมัติส่วนลด 3% เป็นพิเศษ รอยืนยัน",
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
    id: 5, title: "รายการตรวจปิดการขาย โรงงานสำเร็จรูป", category: "ทั่วไป", pinned: false,
    content: "สิ่งที่ต้องทำก่อนปิดการขาย โรงงานสำเร็จรูป นครสวรรค์:\n\n☑ ยืนยันรายละเอียดใบเสนอราคาครบ\n☑ ตรวจสอบเงื่อนไขการชำระเงิน\n☑ ส่งเอกสารสัญญาให้ลูกค้า\n☑ ทบทวนเงื่อนไขร่วมกับลูกค้า\n☐ รับเงินงวดสุดท้าย\n☐ ออกใบรับประกัน",
    author: "สมชาย", createdAt: "2026-06-15 08:00", updatedAt: "2026-06-21 13:00", color: "#6b7280",
  },
  {
    id: 6, title: "ติดตาม หจก. ราชบุรีโลหะ", category: "โอกาสการขาย", pinned: false,
    content: "โอกาสการขายโกดังสำเร็จรูป ราชบุรี 760K\nลูกค้ายังลังเลเรื่องราคา เปรียบเทียบกับคู่แข่ง\n\nจุดแข็งที่ต้องเน้น:\n- Benjamin มาตรฐาน ISO\n- รับประกัน 5 ปี\n- ส่งได้เร็วกว่า (8 สัปดาห์)\n\nวางแผนโทรติดตามอีกครั้ง 25 มิ.ย.",
    customerId: 3, customerName: "หจก. ราชบุรีโลหะ",
    author: "วิภา", createdAt: "2026-06-17 09:30", updatedAt: "2026-06-17 09:30", color: "#b45309",
  },
];
