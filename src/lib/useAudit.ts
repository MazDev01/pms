"use client";

// ─── Audit Log ของ HQ — บันทึกจริงว่า "ใครทำอะไร เมื่อไร" ──────────────────────
// HQ มีผู้ใช้หลายคน → ทุก action สำคัญของ admin ถูกบันทึกลง localStorage (พร้อมต่อ Supabase)
// บันทึกผ่าน useAuditLogger() ในจุด mutation · ดูผ่านหน้า /hq/audit (useAuditEntries)
import { useCallback, useEffect, useState } from "react";
import { useRole } from "@/context/RoleContext";

export type AuditEntry = { id: number; user: string; role: string; action: string; target: string; at: string };
const KEY = "hq_audit_log_v1";
const EVENT = "bpms-audit-updated";
const MAX = 300;
const TH_MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ประวัติตั้งต้น (แสดงทันทีก่อนมี action จริง) — action จริงจะถูก prepend ทับ
const SEED: AuditEntry[] = [
  { id: 5, user: "วิชัย ประสิทธิ์", role: "HQ_MANAGEMENT", action: "แก้ราคากลาง", target: "โรงงาน · ฿6,800 → ฿7,000", at: "30 มิ.ย. 2569 · 09:22" },
  { id: 3, user: "วิชัย ประสิทธิ์", role: "HQ_MANAGEMENT", action: "ระงับตัวแทน", target: "RYG (ระยองสตีลเวิร์คส์)", at: "29 มิ.ย. 2569 · 17:05" },
  { id: 2, user: "กิตติ พรมมา", role: "HQ_MANAGEMENT", action: "เพิ่มผู้ใช้ HQ", target: "weerapol@benjamin.co.th", at: "29 มิ.ย. 2569 · 14:30" },
  { id: 1, user: "อารยา สุขวิเศษ", role: "HQ_MANAGEMENT", action: "แก้เป้าเครือ", target: "฿260M → ฿280M (ปี 2569)", at: "28 มิ.ย. 2569 · 11:12" },
];

export function loadAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as AuditEntry[]; } catch {}
  return [...SEED];
}
function stampNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${TH_MO[d.getMonth()]} ${d.getFullYear() + 543} · ${hh}:${mm}`;
}
export function appendAudit(e: { user: string; role: string; action: string; target: string }) {
  if (typeof window === "undefined") return;
  const list = loadAudit();
  const id = (list.reduce((m, x) => Math.max(m, x.id), 0)) + 1;
  const next = [{ id, at: stampNow(), ...e }, ...list].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new Event(EVENT)); } catch {}
}

// hook สำหรับ "บันทึก" — ใช้ชื่อ/บทบาทของผู้ใช้ปัจจุบันจาก session อัตโนมัติ
export function useAuditLogger() {
  const { session, role } = useRole();
  return useCallback((action: string, target: string) => {
    appendAudit({ user: session.name, role, action, target });
  }, [session.name, role]);
}

// hook สำหรับ "ดู" — โหลด + ฟังอัปเดตแบบเรียลไทม์
export function useAuditEntries(): AuditEntry[] {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => {
    setEntries(loadAudit());
    const sync = () => setEntries(loadAudit());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return entries;
}
