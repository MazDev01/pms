// สัญญาข้อมูลกลาง (Data Layer) — type เดียวใช้ทั้ง LocalAdapter และ SupabaseAdapter
// เพื่อไม่ให้ shape ข้อมูลระหว่าง local/backend หลุดจากกัน (drift)
export type {
  LeadRow, CustomerRow, QuotationMock, AppointmentMock,
  DealerRow, SolutionProduct, DealerFile, ResponsiblePerson,
  HQPolicy, HQTargets, HQNotifRules, LeadRules, DealerLeadRulesMap, QuoteNumbering,
} from "@/lib/mock";
export type { AuditEntry } from "@/lib/useAudit";

// ขอบเขตข้อมูล — ส่งเข้าทุก query ที่ผูกกับสาขา
// วันนี้ LocalAdapter ใช้ filter · เฟส B ส่งให้ RLS ที่ Supabase คุมแทน
export type Scope = { dealerCode?: string; isHQ?: boolean };
