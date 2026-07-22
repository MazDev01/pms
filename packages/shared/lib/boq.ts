// BOQ — รายการสินค้าของใบเสนอราคา (แหล่งเดียว)
// ใบที่สร้างจากฟอร์มใหม่มี lineItems ครบ · ใบเก่า/ใบที่ย้ายข้อมูลมามีแต่ยอดรวม
// จึง "สังเคราะห์" เป็นรายการเดียวจากข้อมูลจริงที่มีอยู่ (แม่แบบ + พื้นที่ + ราคารวม) ไม่ได้กุตัวเลขใหม่
// เดิมตรรกะนี้ก๊อปกันอยู่ 5 ที่ (หน้าใบเสนอราคา 2 · หน้าลูกค้า 1 · แผงใบเสนอราคาของลีด 2) แก้ที่เดียวไม่ครบ
import type { QuoteLineItem } from "./mock";

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
