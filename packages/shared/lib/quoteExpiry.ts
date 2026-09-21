// ── วันหมดอายุของใบเสนอราคา (ISO) — ที่เดียวทั้งแอป ──
// ใบที่กรอกวันเองใช้ค่านั้น · ไม่ได้กรอก = วันที่ใบ + อายุใบเสนอราคา (ของสาขา ถ้าไม่ได้ตั้งค่อยใช้ของ HQ — ดู useQuoteValidity)
// validityDays ส่งเข้ามาจากหน้าจอ — ห้ามอ่าน localStorage ตรงนี้ (โหมดจริงค่าอยู่ใน DB)
export function quoteExpiryISO(q: { date: string; expiry?: string }, validityDays: number): string {
  if (q.expiry) return q.expiry;
  if (!q.date) return "";
  const d = new Date(q.date); if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + validityDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** จำนวนวันจาก todayISO ถึงวันหมดอายุ (ติดลบ = เลยมาแล้ว) · อ่านวันไม่ได้ = null */
export function daysUntilISO(iso: string, todayISO: string): number | null {
  const a = Date.parse(iso), b = Date.parse(todayISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86400000);
}
