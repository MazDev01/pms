"use client";

// ─── Audit Log ของ HQ — บันทึกจริงว่า "ใครทำอะไร เมื่อไร" ──────────────────────
// HQ มีผู้ใช้หลายคน → ทุก action สำคัญของ admin ถูกบันทึกลง localStorage (พร้อมต่อ Supabase)
// บันทึกผ่าน useAuditLogger() ในจุด mutation · ดูผ่านหน้า /hq/audit (useAuditEntries)
import { useCallback, useEffect, useState } from "react";
import { logRepoRead } from "./repoLog";
import { useRole } from "@pms/shared/context/RoleContext";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { audit as auditRepo } from "@pms/shared/lib/data";

export type AuditEntry = { id: number; user: string; role: string; action: string; target: string; at: string };
// เพดานอ่าน audit_log (M8) — ตารางนี้ append-only โตไม่จำกัด · หน้า /hq/audit แจ้งเมื่อชนเพดาน (ไม่ตัดเงียบ)
export const AUDIT_READ_CAP = 5000;
// v2: SEED เดิม (v1) มีรายการของฟีเจอร์ที่ถูกลบแล้ว ("ตั้งเพดานส่วนลด") + คำเก่า ("ระงับตัวแทน")
// loadAudit อ่าน localStorage ก่อน SEED → เบราว์เซอร์เก่าจะเห็นของค้างตลอดแม้ SEED ในโค้ดสะอาดแล้ว
// ขึ้นเวอร์ชันคีย์ + ลบคีย์เก่าทิ้ง เพื่อบังคับ re-seed จาก SEED ปัจจุบัน (กติกา version-key ของทั้งระบบ)
const KEY = "hq_audit_log_v2";
const KEY_OLD = ["hq_audit_log_v1"];
const EVENT = "bpms-audit-updated";
const MAX = 300;
const TH_MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ไม่มีชุดตั้งต้น (SEED) แล้ว — เดิมมีรายการบันทึกตรวจสอบสมมติ 4 รายการ (ชื่อคน/เหตุการณ์/วันที่)
// ที่แสดงเหมือนของจริง = ขัดกติกา "ห้ามกุข้อมูล" (M3) · ยังไม่มี action จริง = โชว์สถานะว่าง
export function loadAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try { KEY_OLD.forEach(k => localStorage.removeItem(k)); } catch {} // ล้าง seed เก่าที่มีของฟีเจอร์ที่ลบแล้ว
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as AuditEntry[]; } catch {}
  return [];
}
// ประทับ "วันนี้" ของระบบ (APP_NOW = 30 มิ.ย. 2569) ไม่ใช่นาฬิกาเครื่อง — กติกาเดียวกับทั้งระบบ
// เดิมใช้ new Date() → รายการที่เพิ่งบันทึกได้วันจริง (เช่น 17 ก.ค.) ซึ่งอยู่นอกช่วงตัวกรองเวลาของ /hq/audit
// (ช่วงกว้างสุดจบที่ 30 มิ.ย. 2569) → HQ ทำอะไรไปก็ไม่เห็นในบันทึกของตัวเอง
// เวลา (ชม.:นาที) ยังใช้นาฬิกาจริงได้ — ใช้เรียงลำดับเหตุการณ์ในวันเดียวกัน ไม่มีผลกับตัวกรองวันที่
function stampNow(): string {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0");
  return `${APP_NOW.getDate()} ${TH_MO[APP_NOW.getMonth()]} ${APP_NOW.getFullYear() + 543} · ${hh}:${mm}`;
}
export function appendAudit(e: { user: string; role: string; action: string; target: string }) {
  if (typeof window === "undefined") return;
  const list = loadAudit();
  const id = (list.reduce((m, x) => Math.max(m, x.id), 0)) + 1;
  const next = [{ id, at: stampNow(), ...e }, ...list].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event(EVENT)); } catch {}
}

// hook สำหรับ "บันทึก" — ใช้ชื่อ/บทบาทของผู้ใช้ปัจจุบันจาก session อัตโนมัติ · เขียนผ่าน repository
// (local: appendAudit เดิม · supabase: insert DB) แล้วยิง event ให้หน้า/กระดิ่งอัปเดตทันที
export function useAuditLogger() {
  const { session, role } = useRole();
  return useCallback((action: string, target: string) => {
    auditRepo.append({ user: session.name, role, action, target })
      .then(() => { try { window.dispatchEvent(new Event(EVENT)); } catch {} })
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
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", read); };
  }, [limit]);
  return entries;
}
