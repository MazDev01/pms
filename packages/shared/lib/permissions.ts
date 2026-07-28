import type { UserRole } from "./mock";

// ─── สิทธิ์ในแอป — ต้อง "ตรงกับ RLS ที่ DB" เสมอ ────────────────────────────────
// กติกาธุรกิจ (Benjamin): ตัวแทน = เจ้าของงานขาย · HQ = ผู้กำกับดูแลทั้งเครือ
//   → HQ "เห็นงานขายทุกสาขา" แต่ "แก้ของตัวแทนไม่ได้"  (ดู 0002_rls.sql: policy เขียน = dealer_code = auth_dealer())
//
// ⚠️ เดิม HQ ทุก role สืบทอด DEALER_BASE ซึ่งมีสิทธิ์ create/update/delete งานขาย
//    ทำให้แอปเปิดปุ่มให้กด แต่ DB ปฏิเสธ → ผู้ใช้เข้าใจผิดว่าบันทึกแล้ว (ดู C1/C3 ในรายงาน)
//    ตอนนี้ตัดสิทธิ์เขียนงานขายออกจากฝั่ง HQ ให้ตรงกับ DB
export type Permission =
  | "leads:create" | "leads:read" | "leads:update" | "leads:delete"
  | "customers:create" | "customers:read" | "customers:update" | "customers:delete"
  | "quotations:create" | "quotations:read" | "quotations:update" | "quotations:delete"
  | "tasks:manage"
  | "catalog:edit"
  | "dealers:manage"
  | "users:manage"
  | "reports:view"
  | "analytics:view"
  | "hq:all_data";

// อ่านงานขาย — ทั้งตัวแทน (สาขาตัวเอง) และ HQ (ทั้งเครือ) มีสิทธิ์นี้
// ขอบเขตว่าเห็นแค่ไหน ถูกบังคับที่ RLS ไม่ใช่ที่รายการสิทธิ์นี้
const SALES_READ: Permission[] = ["leads:read", "customers:read", "quotations:read"];

// เขียนงานขาย — เฉพาะตัวแทนเท่านั้น (RLS: dealer_code = auth_dealer())
const SALES_WRITE: Permission[] = [
  "leads:create", "leads:update", "leads:delete",
  "customers:create", "customers:update", "customers:delete",
  "quotations:create", "quotations:update", "quotations:delete",
];

// ตัวแทน = เจ้าของงานขายในสาขาตัวเอง
const DEALER_BASE: Permission[] = [...SALES_READ, ...SALES_WRITE, "tasks:manage", "reports:view"];

// HQ = ดูทั้งเครือ + วิเคราะห์ · ไม่มีสิทธิ์เขียนงานขาย และไม่จัดการ task ของตัวแทน
const HQ_BASE: Permission[] = [...SALES_READ, "reports:view", "analytics:view"];

// สิทธิ์ระดับเครือ (ข้อมูลกลางที่ HQ เป็นเจ้าของ) — RLS ฝั่ง DB คุมด้วย can_write_master()
const HQ_MASTER: Permission[] = ["catalog:edit", "dealers:manage", "users:manage", "hq:all_data"];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN:   [...HQ_BASE, ...HQ_MASTER],
  HQ_MANAGEMENT: [...HQ_BASE, ...HQ_MASTER],
  HQ_STAFF:      [...HQ_BASE],                 // ดูได้ทั้งเครือ แต่แก้ข้อมูลกลาง/ตั้งค่าไม่ได้
  DEALER_ADMIN:  [...DEALER_BASE, "analytics:view"],
  DEALER_SALES:  DEALER_BASE,
  DEALER_SITE:   ["leads:read", "customers:read"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ทุกบทบาทฝั่งสำนักงานใหญ่ (ไม่มี dealer_code) — แหล่งเดียว เดิมประกาศซ้ำใน supabaseAuth.ts /
// api/admin/users/route.ts แยกกัน (เสี่ยงตกหล่นถ้าเพิ่มบทบาท HQ ใหม่ในอนาคต) · 1.5/SSOT
export const HQ_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "HQ_MANAGEMENT", "HQ_STAFF"];
