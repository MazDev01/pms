// ── ตัวชี้วัดของลีด (pure functions) — แหล่งเดียว ใช้ร่วมกันทั้งหน้าลีดและแดชบอร์ด ──
// ไม่มี state / ไม่มี UI — คำนวณล้วน (deterministic, mock วันนี้ = 2026-06-30)
import { buildLeadTasks, taskProgress, type LeadRow } from "@pms/shared/lib/mock";

export const MOCK_TODAY = new Date(2026, 5, 30); // 2026-06-30

// ── มูลค่า ──
export function parseValue(v: string): number {
  const n = parseFloat(String(v).replace(/[฿,\s]/g, ""));
  if (!isFinite(n)) return 0;
  if (/T/i.test(v)) return n * 1e12;
  if (/B/i.test(v)) return n * 1e9;
  if (/M/i.test(v)) return n * 1e6;
  if (/K/i.test(v)) return n * 1e3;
  return n;
}

// ── วันที่ไทย ("22 มิ.ย. 2569") → Date (พ.ศ. − 543) ──
const TH_MONTH: Record<string, number> = {
  "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5,
  "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11,
};
export function parseThaiDate(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(s.trim());
  if (!m || !(m[2] in TH_MONTH)) return null;
  const y = +m[3] > 2500 ? +m[3] - 543 : +m[3];
  return new Date(y, TH_MONTH[m[2]], +m[1]);
}

// วันที่สร้างลีด — ลีด seed ส่วนใหญ่ไม่มี createdAt → ใช้วันที่คงที่ (deterministic) จาก numId
// กระจายภายใน ~150 วันล่าสุด เพื่อให้กราฟ/ไทม์ไลน์มีข้อมูลจริง ไม่แบนที่ 0
export function leadCreatedDate(l: LeadRow): Date {
  const d = parseThaiDate(l.createdAt);
  if (d) return d;
  const x = new Date(MOCK_TODAY);
  x.setDate(x.getDate() - ((l.numId * 17) % 150));
  return x;
}

// วันที่ติดต่อล่าสุดของลีด (จากกิจกรรม · ไม่มีกิจกรรม → ใช้วันที่สร้าง)
export function leadLatestDate(l: LeadRow): Date | null {
  const dates = (l.activities ?? []).map(a => parseThaiDate(a.date)).filter(Boolean) as Date[];
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}
export function lastContactLabel(l: LeadRow): string { return l.activities?.[0]?.date ?? (l.createdAt ?? "—"); }

// ── ลีดที่ต้องรีบติดตาม (ขาดการติดต่อเกิน N วัน) — กฎธุรกิจเดียวที่มี (ไม่มี SLA) ──
export function daysSinceContact(l: LeadRow): number | null {
  const d = leadLatestDate(l) ?? parseThaiDate(l.createdAt);
  if (!d) return null;
  return Math.floor((MOCK_TODAY.getTime() - d.getTime()) / 86400000);
}
export function isLeadOpen(l: LeadRow): boolean { return l.status !== "PAID" && l.status !== "CANCELLED"; }
export function needsFollowUp(l: LeadRow, threshold = 7): boolean {
  if (!isLeadOpen(l)) return false; // ปิดแล้วไม่ต้องตาม
  const days = daysSinceContact(l);
  return days !== null && days > threshold;
}

// ── ความสำคัญ (deterministic ตามมูลค่า) ──
export type Priority = "HIGH" | "MEDIUM" | "LOW";
export const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];
export const priorityLabel: Record<Priority, string> = { HIGH: "สูง", MEDIUM: "กลาง", LOW: "ต่ำ" };
export const priorityColor: Record<Priority, { text: string; bg: string }> = {
  HIGH:   { text: "#DC3545", bg: "#fee2e2" },
  MEDIUM: { text: "#FFC107", bg: "#fff8e1" },
  LOW:    { text: "#6b7280", bg: "#f0f0f5" },
};
export const priorityRank: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
export function leadPriority(lead: LeadRow): Priority {
  const v = parseValue(lead.value);
  if (v >= 3e6) return "HIGH";
  if (v >= 1e6) return "MEDIUM";
  return "LOW";
}

// ── ความคืบหน้า (%) — จากงานมาตรฐาน 7 ข้อเท่านั้น (ห้ามลาก slider) ──
export function leadProgress(l: LeadRow): number {
  if (l.status === "PAID") return 100;
  if (l.status === "CANCELLED") return 0;
  return taskProgress(l.tasks?.length ? l.tasks : buildLeadTasks());
}
