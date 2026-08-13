// BOQ — รายการสินค้าของใบเสนอราคา (แหล่งเดียว)
// ใบที่สร้างจากฟอร์มใหม่มี lineItems ครบ · ใบเก่า/ใบที่ย้ายข้อมูลมามีแต่ยอดรวม
// จึง "สังเคราะห์" เป็นรายการเดียวจากข้อมูลจริงที่มีอยู่ (แม่แบบ + พื้นที่ + ราคารวม) ไม่ได้กุตัวเลขใหม่
// เดิมตรรกะนี้ก๊อปกันอยู่ 5 ที่ (หน้าใบเสนอราคา 2 · หน้าลูกค้า 1 · แผงใบเสนอราคาของลีด 2) แก้ที่เดียวไม่ครบ
import type { QuoteLineItem, SolutionProduct } from "./mock";
import { parseBaht } from "./format";

/** ข้อมูลขั้นต่ำที่ใช้ปั้น BOQ — รับได้ทั้ง QuotationMock และฟอร์มระหว่างแก้ */
export type BoqSource = {
  lineItems?: QuoteLineItem[];
  materialCost: number;
  buildingType: string;
  area: number;
};

/** รายการ BOQ ที่ใช้แสดง/แก้ — ไม่มีข้อมูลให้ปั้นเลยคืนว่าง (หน้าจอขึ้นสถานะว่าง ไม่ใช่เลข 0 หลอก ๆ) */
export function boqLineItems(q: BoqSource): QuoteLineItem[] {
  if (q.lineItems) return q.lineItems;
  if (q.materialCost <= 0) return [];
  return [{
    name: q.buildingType || "รายการ",
    qty: q.area || 1,
    unit: q.area ? "ตร.ม." : "รายการ",
    unitPrice: q.area ? Math.round(q.materialCost / q.area) : q.materialCost,
  }];
}

/** ยอดรวมก่อน VAT = Σ(จำนวน × ราคา/หน่วย) */
export function boqSubtotal(items: QuoteLineItem[]): number {
  return items.reduce((s, li) => s + li.qty * li.unitPrice, 0);
}

/** ข้อมูลจากลูกค้าเป้าหมาย/ลูกค้า ที่ใช้ตั้งต้น BOQ ของใบใหม่ */
export type SeedSubject = {
  /** แม่แบบที่เลือกไว้ — ตรงกับชื่อหลัก หรือชื่อประเภทย่อยในแคตตาล็อก */
  product: string;
  /** มูลค่าประเมิน (ข้อความอย่าง "฿155K" ก็ได้) */
  value?: string;
  /** พื้นที่ที่กรอกไว้ (ตร.ม.) */
  area?: number;
};

// ── BOQ ตั้งต้นของใบเสนอราคาใหม่ ────────────────────────────────────────────────
// แยกออกมาจากคอมโพเนนต์เพื่อ (1) ทดสอบได้จริง (2) เรียกซ้ำได้ตอนแคตตาล็อกมาช้า
//
// ⚠️ ต้องเรียกใหม่เมื่อแคตตาล็อกโหลดเสร็จ — useMasterCatalog เริ่มด้วยรายการว่างเสมอ
//    แล้วค่อยเติมทีหลัง ถ้าคิด BOQ ครั้งเดียวตอนเปิดฟอร์ม จะได้ราคากลาง = 0 → ไม่มีรายการ
//    และหน้านั้นซ่อนปุ่ม "เลือกจากแคตตาล็อก" ไว้ ผู้ใช้จึงเพิ่มแถวเองไม่ได้ = ออกใบไม่ได้เลย
//    (ผู้ใช้แจ้ง 11 ส.ค. 69 "ไม่มีตัวแม่แบบขึ้นมา" ทั้งที่ลีดระบุแม่แบบและมูลค่าไว้ครบ)
export function seedLineItems(subj: SeedSubject, catalog: SolutionProduct[]): QuoteLineItem[] {
  if (!subj.product) return [];
  // ลีดอาจระบุ "แม่แบบย่อย" (เช่น โรงยิมอเนกประสงค์ อยู่ใต้ สนามกีฬาในร่ม) → หาทั้ง 2 ชั้น
  const prod = catalog.find(p => p.name === subj.product)
            ?? catalog.find(p => p.subtypes?.includes(subj.product));
  const rate = prod?.price ?? 0;
  if (rate <= 0) return [];   // ยังไม่รู้ราคากลาง = ยังปั้นไม่ได้ (ไม่ใช่ปั้นด้วยเลข 0)

  // จำนวนตั้งต้น เรียงตามความน่าเชื่อถือของข้อมูล:
  //  1) พื้นที่ที่กรอกไว้ในลีด + แม่แบบคิดเป็น ตร.ม. → ใช้ตัวเลขจริงจากลีด (ตรงที่สุด · บอสสั่ง 17 ก.ค. 69)
  //  2) ไม่มีพื้นที่ → ถอดกลับจาก มูลค่าประเมิน ÷ ราคากลาง (ประมาณเอา)
  // มีมูลค่าประเมินแล้วต้องได้อย่างน้อย 1 หน่วยเสมอ — มูลค่าที่น้อยกว่าราคากลาง 1 หน่วย
  // เคยปัดลงเป็น 0 แล้วคืนตารางว่าง ซึ่งผู้ใช้เพิ่มแถวเองไม่ได้ = ออกใบไม่ได้
  const est = parseBaht(subj.value || "");
  const areaQty = prod!.unit === "ตร.ม." && (subj.area ?? 0) > 0 ? subj.area! : 0;
  const qty = areaQty > 0 ? areaQty : (est > 0 ? Math.max(1, Math.round(est / rate)) : 0);
  if (qty <= 0) return [];

  return [{ name: subj.product, qty: Math.max(1, qty), unit: prod!.unit, unitPrice: rate }];
}
