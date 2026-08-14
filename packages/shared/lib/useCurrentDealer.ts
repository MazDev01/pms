"use client";

import { useRole } from "@pms/shared/context/RoleContext";
import { DEFAULT_DEALER_CODE } from "@pms/shared/lib/mock";
import { useDealerSettings } from "@pms/shared/lib/useDealerSettings";

// ดีลเลอร์ปัจจุบัน = จาก session ที่ล็อกอิน (multi-tenant)
// HQ เพิ่มสาขา → สาขานั้นล็อกอิน (signIn คืน dealerCode ของตัวเอง) แล้วเห็น/แก้ข้อมูลสาขาตัวเอง
// dealerCode ว่าง (เดโม/HQ) → default CNX เพื่อให้พฤติกรรมเดิมของสาขาที่เล่นได้ยังทำงาน
export function useCurrentDealer(): { code: string; name: string } {
  const { dealerCode, session } = useRole();
  const code = dealerCode || DEFAULT_DEALER_CODE;
  const name = dealerCode ? (session.dealerName || dealerCode) : "เชียงใหม่สตีลบิลด์";
  return { code, name };
}

/** ชื่อสาขาที่ "แสดงบนหน้าจอ" — ชื่อบริษัทที่สาขากรอกเองมาก่อนเสมอ (บอสสั่ง 14 ส.ค. 69)
 *
 *  ทำไมไม่ใช้ dealers.name อย่างเดียว: ชื่อในทะเบียนเป็นของที่สำนักงานใหญ่กรอกตอนเปิดสาขา
 *  บางสาขาจึงถูกตั้งชื่อเป็นรหัสสาขาไปเลย (เจอจริง: ทะเบียนเป็น "DSA" แต่สาขากรอกชื่อบริษัทจริงว่า
 *  "เชียงใหม่สติล") ผลคือแถบบน/เมนูซ้ายขึ้น "DSA" ขณะที่การ์ดบัญชีในหน้าตั้งค่าขึ้นชื่อบริษัทจริง
 *  — ชื่อเดียวกันแต่คนละค่าในหน้าจอเดียว
 *
 *  ลำดับ: ชื่อบริษัทที่สาขากรอก → ชื่อในทะเบียนของ HQ → รหัสสาขา (ท้ายสุด ดีกว่าไม่มีอะไรเลย)
 *  ใช้ที่เดียวกันทั้ง แถบบน · เมนูซ้าย · หัวการ์ดบัญชีดีลเลอร์ — ห้ามคิดเองซ้ำที่อื่น
 */
export function useDealerDisplayName(): string {
  const dealer = useCurrentDealer();
  const cfg = useDealerSettings();
  const company = cfg.loaded ? cfg.settings.issuer?.company?.trim() : "";
  return company || dealer.name || dealer.code;
}
