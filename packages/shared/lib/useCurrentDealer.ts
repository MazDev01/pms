"use client";

import { useRole } from "@pms/shared/context/RoleContext";
import { DEFAULT_DEALER_CODE } from "@pms/shared/lib/mock";

// ดีลเลอร์ปัจจุบัน = จาก session ที่ล็อกอิน (multi-tenant)
// HQ เพิ่มสาขา → สาขานั้นล็อกอิน (signIn คืน dealerCode ของตัวเอง) แล้วเห็น/แก้ข้อมูลสาขาตัวเอง
// dealerCode ว่าง (เดโม/HQ) → default CNX เพื่อให้พฤติกรรมเดิมของสาขาที่เล่นได้ยังทำงาน
export function useCurrentDealer(): { code: string; name: string } {
  const { dealerCode, session } = useRole();
  const code = dealerCode || DEFAULT_DEALER_CODE;
  const name = dealerCode ? (session.dealerName || dealerCode) : "เชียงใหม่สตีลบิลด์";
  return { code, name };
}
