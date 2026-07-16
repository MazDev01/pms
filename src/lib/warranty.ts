// ─── กฎการส่งมอบและการรับประกัน (แหล่งเดียวของทั้งระบบ) ──────────────────────
// ยึดตามที่โปรเจกต์ใช้อยู่เดิมในหน้าลูกค้าฝั่งตัวแทน:
//   วันส่งมอบ   = วันปิดการขาย (won) + ระยะเวลาส่งมอบของใบนั้น (ไม่ระบุ = DEFAULT_DELIVERY_DAYS)
//   การรับประกัน = โครงสร้าง 10 ปี นับจากวันส่งมอบ (มาตรฐาน PEB)
// ไม่มีวันปิดการขาย = ยังไม่ส่งมอบ → ไม่มีประกัน (คืน null · ห้ามเดา)
import { DEFAULT_DELIVERY_DAYS } from "./mock";

export const WARRANTY_YEARS = 10;
export const TODAY = new Date(2026, 5, 30); // "วันนี้" ของระบบ (deterministic)

const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH: Record<string, number> = Object.fromEntries(TH_ABBR.map((m, i) => [m, i]));

/** "15 พ.ค. 2569" → Date · คืน null ถ้าอ่านไม่ได้ */
export function parseThaiDate(s?: string): Date | null {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s ?? "").trim());
  if (!m || !(m[2] in TH_MONTH)) return null;
  return new Date(+m[3] - 543, TH_MONTH[m[2]], +m[1]);
}
export const toThaiDate = (d: Date) => `${d.getDate()} ${TH_ABBR[d.getMonth()]} ${d.getFullYear() + 543}`;

/** จำนวนวันส่งมอบจากข้อความ (เช่น "120 วัน") — ไม่ระบุ = ค่ามาตรฐานที่ HQ กำหนด */
export const deliveryDaysOf = (deliveryTime?: string): number =>
  parseInt(String(deliveryTime ?? "").replace(/[^0-9]/g, "")) || DEFAULT_DELIVERY_DAYS;

/** วันส่งมอบ = วันปิดการขาย + ระยะเวลาส่งมอบ · ไม่มีวันปิดการขาย = null */
export function deliveryDateOf(wonDate?: string, deliveryTime?: string): Date | null {
  const d = parseThaiDate(wonDate);
  if (!d) return null;
  const out = new Date(d);
  out.setDate(out.getDate() + deliveryDaysOf(deliveryTime));
  return out;
}

export type Warranty = {
  status: "active" | "expired";
  delivered: string;      // วันส่งมอบ (ไทย)
  expiry: string;         // วันหมดประกัน (ไทย)
  remainingLabel: string; // "เหลือ 3 ปี 2 เดือน" / "หมดประกันแล้ว"
};

/** สถานะประกันจากวันปิดการขาย · คืน null ถ้ายังไม่ปิดการขาย (= ยังไม่ส่งมอบ) */
export function warrantyOf(wonDate?: string, deliveryTime?: string): Warranty | null {
  const del = deliveryDateOf(wonDate, deliveryTime);
  if (!del) return null;
  const exp = new Date(del);
  exp.setFullYear(exp.getFullYear() + WARRANTY_YEARS);

  const active = exp > TODAY;
  let remainingLabel = "หมดประกันแล้ว";
  if (active) {
    let months = (exp.getFullYear() - TODAY.getFullYear()) * 12 + (exp.getMonth() - TODAY.getMonth());
    if (exp.getDate() < TODAY.getDate()) months--;
    const y = Math.floor(months / 12), m = months % 12;
    remainingLabel = y > 0 ? (m > 0 ? `เหลือ ${y} ปี ${m} เดือน` : `เหลือ ${y} ปี`) : `เหลือ ${Math.max(1, m)} เดือน`;
  }
  return { status: active ? "active" : "expired", delivered: toThaiDate(del), expiry: toThaiDate(exp), remainingLabel };
}
