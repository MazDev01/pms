"use client";

// ─── Audit Log ของ HQ — บันทึกจริงว่า "ใครทำอะไร เมื่อไร" ──────────────────────
// HQ มีผู้ใช้หลายคน → ทุก action สำคัญของ admin ถูกบันทึกไว้ (local: localStorage · supabase: DB)
// บันทึกผ่าน useAuditLogger() ในจุด mutation · ดูผ่านหน้า /hq/audit (useAuditEntries)
//
// ไฟล์นี้เหลือเฉพาะ React hook ที่คุยกับ repository — ส่วนอ่าน/เขียน localStorage ย้ายไป auditStore.ts
// เพราะ LocalAdapter (ชั้นข้อมูล) ต้องใช้ส่วนนั้น แล้วเกิดวงจร import ย้อนกลับมาที่ไฟล์นี้
// (ดูเหตุผลเต็มใน auditStore.ts · พบจากผลตรวจสอบระบบ 5 ส.ค. 69)
import { useCallback, useEffect, useState } from "react";
import { logRepoRead } from "./repoLog";
import { useRole } from "@pms/shared/context/RoleContext";
import { audit as auditRepo } from "@pms/shared/lib/data";
import { AUDIT_EVENT } from "@pms/shared/lib/auditStore";
import type { AuditEntry } from "@pms/shared/lib/data/types";

// re-export ให้โค้ดเดิมที่ import ชนิด/ฟังก์ชันจากไฟล์นี้ยังใช้ได้เหมือนเดิม
export type { AuditEntry } from "@pms/shared/lib/data/types";
export { loadAudit, appendAudit, AUDIT_EVENT } from "@pms/shared/lib/auditStore";

// เพดานอ่าน audit_log (M8) — ตารางนี้ append-only โตไม่จำกัด · หน้า /hq/audit แจ้งเมื่อชนเพดาน (ไม่ตัดเงียบ)
export const AUDIT_READ_CAP = 5000;

// hook สำหรับ "บันทึก" — ใช้ชื่อ/บทบาทของผู้ใช้ปัจจุบันจาก session อัตโนมัติ · เขียนผ่าน repository
// (local: appendAudit เดิม · supabase: insert DB) แล้วยิง event ให้หน้า/กระดิ่งอัปเดตทันที
export function useAuditLogger() {
  const { session, role } = useRole();
  return useCallback((action: string, target: string) => {
    auditRepo.append({ user: session.name, role, action, target })
      .then(() => { try { window.dispatchEvent(new Event(AUDIT_EVENT)); } catch {} })
      .catch((e) => console.error("[audit.append]", e));
  }, [session.name, role]);
}

// hook สำหรับ "ดู" — โหลดล่าสุดสูงสุด limit รายการผ่าน repository + ฟังอัปเดตแบบเรียลไทม์
// default = AUDIT_READ_CAP · กระดิ่ง/แดชบอร์ดที่ต้องการแค่ล่าสุดไม่กี่รายการก็ถูกจำกัดตามไปด้วย (M8)
export function useAuditEntries(limit: number = AUDIT_READ_CAP): AuditEntry[] {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => {
    const read = () => { auditRepo.list(limit).then(setEntries).catch((e) => logRepoRead("audit.list", e)); };
    read();
    window.addEventListener(AUDIT_EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(AUDIT_EVENT, read); window.removeEventListener("storage", read); };
  }, [limit]);
  return entries;
}
