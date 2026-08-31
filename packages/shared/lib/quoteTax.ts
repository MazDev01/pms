// ── สูตรภาษีของใบเสนอราคา — ที่เดียวของทั้งระบบ ──────────────────────────────
//
// ใช้ร่วมกันสามที่: ฟอร์มออกใบ (แสดงสด) · เอกสารที่พิมพ์ให้ลูกค้า · ค่าที่บันทึกลงฐานข้อมูล
// ถ้าแยกกันเขียน วันหนึ่งตัวเลขบนจอกับบนกระดาษจะไม่ตรงกัน แล้วไม่มีใครรู้ว่าอันไหนถูก
//
// กติกา (บอสสั่ง 28 ส.ค. 69):
//   มูลค่างาน (ก่อน VAT) = ผลรวมรายการ BOQ  ← ตัวนี้คือ "ยอดขาย" ที่รายงาน/เป้าใช้ ห้ามเปลี่ยน
//   VAT           = มูลค่างาน × VAT%
//   ยอดรวม        = มูลค่างาน + VAT
//   หัก ณ ที่จ่าย = มูลค่างาน × WHT%          ← คิดจากยอดก่อน VAT ตามหลักสรรพากร
//   ยอดชำระสุทธิ  = ยอดรวม − หัก ณ ที่จ่าย
//
// ⚠️ ปัดเศษทีละบรรทัดเป็นสตางค์ (2 ตำแหน่ง) แล้วค่อยบวก — ให้ตรงกับที่พิมพ์บนกระดาษเป๊ะ
//    ถ้าเก็บทศนิยมเต็มแล้วปัดตอนแสดง ผู้ใช้จะเจอ "บวกเองแล้วไม่ตรง" ในเอกสาร

/** อัตราภาษีที่ตรึงไว้กับใบ — 0 หรือไม่ระบุ = ไม่คิดภาษีตัวนั้น */
export type อัตราภาษี = { vatPercent?: number | null; whtPercent?: number | null };

export type ยอดภาษี = {
  /** มูลค่างานก่อน VAT = ผลรวมรายการ BOQ */
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  /** ยอดรวมเป็นเงิน = มูลค่างาน + VAT */
  totalAmount: number;
  whtRate: number;
  whtAmount: number;
  /** ยอดชำระสุทธิ = ยอดรวม − หัก ณ ที่จ่าย */
  netPayable: number;
};

const สตางค์ = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const อัตรา = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0;
};

/** คิดยอดภาษีทั้งชุดจาก "มูลค่างานก่อน VAT" + อัตราที่เลือกไว้ */
export function คิดภาษีใบเสนอราคา(subtotalดิบ: number, r: อัตราภาษี): ยอดภาษี {
  const subtotal = สตางค์(subtotalดิบ);
  const vatRate = อัตรา(r.vatPercent);
  const whtRate = อัตรา(r.whtPercent);
  const vatAmount = สตางค์(subtotal * vatRate / 100);
  const totalAmount = สตางค์(subtotal + vatAmount);
  const whtAmount = สตางค์(subtotal * whtRate / 100);
  const netPayable = สตางค์(totalAmount - whtAmount);
  return { subtotal, vatRate, vatAmount, totalAmount, whtRate, whtAmount, netPayable };
}

/** ค่าที่ต้องบันทึกลงฐานข้อมูลคู่กับใบ (สแนปช็อต ณ วันที่ออกเอกสาร)
 *  ⚠️ ไม่แตะ totalValue — นั่นคือยอดขายที่รายงาน/เป้าใช้อยู่ */
export function ช่องภาษีสำหรับบันทึก(subtotal: number, r: อัตราภาษี) {
  const t = คิดภาษีใบเสนอราคา(subtotal, r);
  return {
    vatPercent: t.vatRate,
    vatAmount: t.vatAmount,
    whtRate: t.whtRate,
    whtAmount: t.whtAmount,
    totalAmount: t.totalAmount,
    netPayable: t.netPayable,
  };
}
