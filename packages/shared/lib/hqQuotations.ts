// ─── ตัวช่วยวิเคราะห์ใบเสนอราคาทั้งเครือ (HQ) ─────────────────────────────────
// แหล่งเดียวของนิยาม "ส่งแล้ว / ค้างอยู่ / อายุใบ / ภูมิภาค" ที่หน้า HQ ใช้ร่วมกัน
//
// ขอบเขตข้อมูลจริง (อย่าเดาเกินนี้):
//  · ไม่มีการติดตามการเปิดอ่าน — สถานะ "เปิดอ่านแล้ว" กับอัตราการเปิดอ่านถูกลบทั้งฟีเจอร์แล้ว
//  · ไม่มีวันที่ลูกค้าตอบรับ/ปฏิเสธ — คำนวณ "จำนวนวันที่ใช้ปิดดีล" ไม่ได้
//  · ใบของสาขาอื่น (seed) ไม่มีรายการสินค้า → ให้แสดง "—" ห้ามเดาขึ้นมาเอง
import { dealerLeaderboard, type HQQuotation, type QuotationStatus } from "@pms/shared/lib/mock";
import { parseDate, APP_NOW } from "@pms/shared/context/FilterContext";

const TH_MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const fmtThaiDate = (d: Date) => `${d.getDate()} ${TH_MO[d.getMonth()]} ${d.getFullYear() + 543}`;

// ภูมิภาคของใบเสนอราคา = ภาคของตัวแทนที่ออกใบ (ใบเสนอราคาไม่มีฟิลด์ภาค/จังหวัดของตัวเอง)
const REGION_BY_DEALER = new Map(dealerLeaderboard.map(d => [d.code, d.region]));
export const regionOfDealer = (code: string) => REGION_BY_DEALER.get(code) ?? "ไม่ระบุ";

// จังหวัดของใบเสนอราคา = จังหวัดของ "ตัวแทนที่ออกใบ" ไม่ใช่จังหวัดลูกค้า/หน้างาน
// (ใบเสนอราคาไม่เก็บจังหวัดของตัวเอง — ทุกที่ที่แสดงต้องกำกับให้ชัดว่าเป็นจังหวัดตัวแทน)
const PROVINCE_BY_DEALER = new Map(dealerLeaderboard.map(d => [d.code, d.province]));
export const provinceOfDealer = (code: string) => PROVINCE_BY_DEALER.get(code) ?? "ไม่ระบุ";
export const ALL_PROVINCES = [...new Set(dealerLeaderboard.map(d => d.province))].sort();
export const regionDisplay = (r: string) => r === "อีสาน" ? "ภาคตะวันออกเฉียงเหนือ" : r === "ไม่ระบุ" ? r : `ภาค${r}`;
export const ALL_REGIONS = [...new Set(dealerLeaderboard.map(d => d.region))];

// ส่งแล้ว = ทุกสถานะที่ไม่ใช่ร่าง · ค้างอยู่ = ส่งแล้วแต่ลูกค้ายังไม่ตอบ
export const isSent = (q: HQQuotation) => q.status !== "draft";
// ค้างอยู่ = ส่งถึงลูกค้าแล้วแต่ยังไม่ตอบรับ/ปฏิเสธ/หมดอายุ → ใช้คิด Aging
export const isPending = (q: HQQuotation) => q.status === "sent_to_client";

export const STATUS_ORDER: QuotationStatus[] = ["draft", "sent_to_client", "won", "lost", "expired"];

export type AgingBucket = "0-7" | "8-14" | "15-30" | "30+";
export const AGING_BUCKETS: { key: AgingBucket; label: string; color: string }[] = [
  { key: "0-7",   label: "0–7 วัน",       color: "#059669" },
  { key: "8-14",  label: "8–14 วัน",      color: "#0891b2" },
  { key: "15-30", label: "15–30 วัน",     color: "#d97706" },
  { key: "30+",   label: "มากกว่า 30 วัน", color: "#dc2626" },
];
export function agingBucketOf(days: number): AgingBucket {
  if (days <= 7) return "0-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  return "30+";
}

/** ใบเสนอราคา + ฟิลด์ที่คำนวณได้จากข้อมูลจริง (ภาค/จังหวัดตัวแทน/อายุ/วันหมดอายุ) */
export type QuoteRow = HQQuotation & {
  region: string;
  dealerProvince: string;     // จังหวัดของตัวแทนที่ออกใบ (ไม่ใช่จังหวัดลูกค้า)
  createdDate: Date | null;
  agingDays: number | null;   // จำนวนวันนับจากวันที่สร้าง ถึง "วันนี้" ของระบบ (30 มิ.ย. 2569)
  validUntil: string | null;  // วันที่สร้าง + อายุใบเสนอราคาตามนโยบาย HQ
  sent: boolean;
  pending: boolean;
};

/** แปลงใบเสนอราคาดิบ → แถวที่หน้า HQ ใช้ (validityDays มาจากนโยบาย HQ — อ่านฝั่ง client) */
export function toQuoteRows(quotes: HQQuotation[], validityDays: number): QuoteRow[] {
  return quotes.map(q => {
    const createdDate = parseDate(q.createdAt);
    const agingDays = createdDate
      ? Math.max(0, Math.round((APP_NOW.getTime() - createdDate.getTime()) / 86_400_000))
      : null;
    let validUntil: string | null = null;
    if (createdDate) {
      const d = new Date(createdDate);
      d.setDate(d.getDate() + validityDays);
      validUntil = fmtThaiDate(d);
    }
    return {
      ...q,
      region: regionOfDealer(q.dealerCode),
      dealerProvince: provinceOfDealer(q.dealerCode),
      createdDate, agingDays, validUntil,
      sent: isSent(q), pending: isPending(q),
    };
  });
}

/** สรุปตัวเลขต่อกลุ่ม (ใช้ซ้ำทั้งรายตัวแทนและรายภูมิภาค) */
export type QuoteAgg = {
  count: number; value: number; sent: number; accepted: number; rejected: number;
  wonValue: number;  // มูลค่าเฉพาะใบที่ปิดการขายได้ = "ยอดขายจริง" ที่เทียบกับมูลค่าใบเสนอราคา
};
export function aggregate(rows: QuoteRow[]): QuoteAgg {
  const sent = rows.filter(r => r.sent).length;
  return {
    count: rows.length,
    value: rows.reduce((s, r) => s + r.valueNum, 0),
    sent,
    accepted: rows.filter(r => r.status === "won").length,
    rejected: rows.filter(r => r.status === "lost").length,
    wonValue: rows.filter(r => r.status === "won").reduce((s, r) => s + r.valueNum, 0),
  };
}

// อัตราการปิดการขาย = ตอบรับ ÷ ใบที่ส่งถึงลูกค้าแล้ว (ไม่นับใบร่าง — ยังไม่ถึงมือลูกค้า)
export const conversionRate = (a: QuoteAgg) => (a.sent ? Math.round((a.accepted / a.sent) * 100) : 0);
// มูลค่าเฉลี่ยต่อใบ — หารด้วยจำนวนใบทั้งหมดที่อยู่ในตัวกรองปัจจุบัน
export const avgQuoteValue = (a: QuoteAgg) => (a.count ? Math.round(a.value / a.count) : 0);

export function groupBy<K extends string>(rows: QuoteRow[], key: (r: QuoteRow) => K): Map<K, QuoteRow[]> {
  const m = new Map<K, QuoteRow[]>();
  rows.forEach(r => {
    const k = key(r);
    const arr = m.get(k); if (arr) arr.push(r); else m.set(k, [r]);
  });
  return m;
}
