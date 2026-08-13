// สัญญาข้อมูลกลาง (Data Layer) — type เดียวใช้ทั้ง LocalAdapter และ SupabaseAdapter
// เพื่อไม่ให้ shape ข้อมูลระหว่าง local/backend หลุดจากกัน (drift)
export type {
  LeadRow, CustomerRow, QuotationMock, AppointmentMock,
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap, QuoteNumbering,
  LeadTaskDef,
} from "@pms/shared/lib/mock";
export type { IssuerProfile, NotifPrefs, UserProfile } from "@pms/shared/lib/mock";
export type { DocProfile } from "@pms/shared/lib/quotationPrint";

// ตั้งค่าทั้งชุดของสาขาหนึ่ง — เดิมกระจายอยู่ใน localStorage 4 คีย์
import type { IssuerProfile as _Issuer, NotifPrefs as _Notif } from "@pms/shared/lib/mock";
import type { DocProfile as _Doc } from "@pms/shared/lib/quotationPrint";
export type DealerSettings = {
  issuer: _Issuer;      // หัวกระดาษ: ชื่อบริษัท/ที่อยู่/โทร/เลขภาษี
  document: _Doc;       // คำนำหน้าเลขที่ · อายุใบ · เงื่อนไข · ตราประทับ · ลายเซ็น
  logo: string;         // โลโก้สัญลักษณ์ (ไอคอน) บนแถบเมนู · "" = ยังไม่ตั้ง
  notifPrefs: _Notif;   // การแจ้งเตือนที่สาขาเปิด/ปิดเอง
};

// รายการในบันทึกตรวจสอบ (audit_log) — ใครทำอะไร เมื่อไหร่
//
// นิยามไว้ที่นี่ ไม่ใช่ที่ useAudit.ts: ไฟล์นี้คือ "สัญญาข้อมูลกลาง" ที่ทุกอย่างในชั้นข้อมูลอ้างถึง
// เดิม re-export มาจาก useAudit.ts (ซึ่งเป็น React hook) ทำให้เกิดวงจร import ย้อนกลับ:
//   types.ts → useAudit.ts → RoleContext.tsx → data/index.ts → LocalAdapter.ts → ports.ts → types.ts
// ตอนนั้นยังไม่พังเพราะเป็น import แบบ type ล้วน (ถูกตัดทิ้งตอนคอมไพล์) แต่เปราะมาก —
// วันไหนมีใครเปลี่ยนเป็นการ import ค่าจริง จะกลายเป็นวงจรตอนรัน (ค่าเป็น undefined ตอน render แรก)
// ย้ายมาไว้ที่นี่แล้วให้ useAudit.ts import กลับไปแทน = ทิศทางถูกต้อง วงจรหายถาวร
export type AuditEntry = {
  id: number; user: string; role: string; action: string; target: string; at: string;
};

// ข้อมูลบริษัทของสำนักงานใหญ่ (แถวเดียวทั้งระบบ)
export type HQCompany = {
  name: string; address: string; taxId: string;
  phone: string; email: string; website: string;
};

// โน้ตของลูกค้า — ของแต่ละสาขา
export type CustomerNote = {
  id: number;
  dealerCode?: string;
  customerId?: number;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  color: string;
  author: string;
  createdAt: string;
  updatedAt: string;
};

// ผู้ใช้ในระบบ (แถวใน profiles) — หน้า /hq/users ใช้แสดง "คนที่ล็อกอินได้จริง"
export type SystemUser = {
  id: string;               // = auth user id
  name: string;
  email: string;            // อีเมลที่ใช้ล็อกอิน (จาก auth) — แก้จากหน้านี้ไม่ได้
  phone: string;
  role: string;             // user_role enum: SUPER_ADMIN | HQ_MANAGEMENT | HQ_STAFF | DEALER_*
  department: string;
  dealerCode: string;       // "" = ผู้ใช้ฝั่งสำนักงานใหญ่
  status: "active" | "inactive";
  createdAt: string;
  avatar?: string;
};

// ขอบเขตข้อมูล — ส่งเข้าทุก query ที่ผูกกับสาขา
// วันนี้ LocalAdapter ใช้ filter · เฟส B ส่งให้ RLS ที่ Supabase คุมแทน
export type Scope = { dealerCode?: string; isHQ?: boolean };
