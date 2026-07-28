// ─── กฎการส่งมอบ (แหล่งเดียวของทั้งระบบ) ──────────────────────────────────────
// ยึดตามที่โปรเจกต์ใช้อยู่เดิมในหน้าลูกค้าฝั่งตัวแทน:
//   วันส่งมอบ = วันปิดการขาย (won) + ระยะเวลาส่งมอบของใบนั้น (ไม่ระบุ = DEFAULT_DELIVERY_DAYS)
// ไม่มีวันปิดการขาย = ยังไม่ส่งมอบ (คืน null · ห้ามเดา)
//
// เดิมชื่อ warranty.ts และมีเรื่องการรับประกัน 10 ปีอยู่ด้วย — ตัดออกทั้งฟีเจอร์แล้ว
// (บอสสั่ง 17 ก.ค. 69: ฝั่งตัวแทนไม่มีประกัน HQ ก็ไม่ต้องมี) เหลือเฉพาะการส่งมอบ
import { DEFAULT_DELIVERY_DAYS } from "./mock";

const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH: Record<string, number> = Object.fromEntries(TH_ABBR.map((m, i) => [m, i]));

/** "15 พ.ค. 2569" → Date · คืน null ถ้าอ่านไม่ได้ */
export function parseThaiDate(s?: string): Date | null {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s ?? "").trim());
  if (!m || !(m[2] in TH_MONTH)) return null;
  return new Date(+m[3] - 543, TH_MONTH[m[2]], +m[1]);
}
export const toThaiDate = (d: Date) => `${d.getDate()} ${TH_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;

/** จำนวนวันส่งมอบจากข้อความ (เช่น "120 วัน") — ไม่ระบุ = ค่ามาตรฐานที่ HQ กำหนด (ใช้ภายในไฟล์นี้เท่านั้น) */
const deliveryDaysOf = (deliveryTime?: string): number =>
  parseInt(String(deliveryTime ?? "").replace(/[^0-9]/g, "")) || DEFAULT_DELIVERY_DAYS;

/** วันส่งมอบ = วันปิดการขาย + ระยะเวลาส่งมอบ · ไม่มีวันปิดการขาย = null */
export function deliveryDateOf(wonDate?: string, deliveryTime?: string): Date | null {
  const d = parseThaiDate(wonDate);
  if (!d) return null;
  const out = new Date(d);
  out.setDate(out.getDate() + deliveryDaysOf(deliveryTime));
  return out;
}
