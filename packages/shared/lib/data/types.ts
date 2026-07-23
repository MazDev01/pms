// สัญญาข้อมูลกลาง (Data Layer) — type เดียวใช้ทั้ง LocalAdapter และ SupabaseAdapter
// เพื่อไม่ให้ shape ข้อมูลระหว่าง local/backend หลุดจากกัน (drift)
export type {
  LeadRow, CustomerRow, QuotationMock, AppointmentMock,
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap, QuoteNumbering,
} from "@pms/shared/lib/mock";
export type { AuditEntry } from "@pms/shared/lib/useAudit";
export type { IssuerProfile, NotifPrefs, UserProfile } from "@pms/shared/lib/mock";
export type { DocProfile } from "@pms/shared/lib/quotationPrint";

// ตั้งค่าทั้งชุดของสาขาหนึ่ง — เดิมกระจายอยู่ใน localStorage 4 คีย์
import type { IssuerProfile as _Issuer, NotifPrefs as _Notif } from "@pms/shared/lib/mock";
import type { DocProfile as _Doc } from "@pms/shared/lib/quotationPrint";
export type DealerSettings = {
  issuer: _Issuer;      // หัวกระดาษ: ชื่อบริษัท/ที่อยู่/โทร/เลขภาษี
  document: _Doc;       // คำนำหน้าเลขที่ · อายุใบ · เงื่อนไข · ตราประทับ · ลายเซ็น
  wordmark: string;     // โลโก้พร้อมชื่อสำหรับหัวเอกสาร (data URI) · "" = ยังไม่ตั้ง
  logo: string;         // โลโก้สัญลักษณ์ (ไอคอน) บนแถบเมนู · "" = ยังไม่ตั้ง
  notifPrefs: _Notif;   // การแจ้งเตือนที่สาขาเปิด/ปิดเอง
};

// ขอบเขตข้อมูล — ส่งเข้าทุก query ที่ผูกกับสาขา
// วันนี้ LocalAdapter ใช้ filter · เฟส B ส่งให้ RLS ที่ Supabase คุมแทน
export type Scope = { dealerCode?: string; isHQ?: boolean };
