// ── ปรับราคากลาง: ราคาแม่แบบย่อยต้องขยับตามแม่แบบหลัก ──────────────────────────
//
// บอสแจ้ง (19 ส.ค. 69): "ตอนปรับราคามันปรับได้แค่ตัวแม่แบบหลัก แม่แบบรองไม่ปรับ"
// แม่แบบย่อยที่ตั้งราคาเฉพาะไว้ (subtypePrices) เคยค้างราคาเดิมตลอด — ใบเสนอราคาที่ออก
// จากแม่แบบย่อยจึงยังคิดราคาเก่า ทั้งที่ผู้ดูแลเชื่อว่าปรับราคาทั้งกลุ่มไปแล้ว

/** ราคาใหม่ของแม่แบบย่อยหนึ่งตัว — รักษา "สัดส่วนต่างจากราคาหลัก" เดิมไว้
 *  เช่น สระว่ายน้ำแพงกว่าหลัก 40% ปรับหลักขึ้น 10% สระก็ยังแพงกว่าหลัก 40% เท่าเดิม
 *  ปัดเป็นจำนวนเต็ม (ราคา/ตร.ม. ไม่ใช้ทศนิยม) และไม่ต่ำกว่า 1 บาท — ฐานข้อมูลบังคับว่าต้องเป็นบวก */
export function scaleSubtypePrice(current: number, basePrice: number, nextPrice: number): number {
  if (!(basePrice > 0) || !(nextPrice > 0) || !(current > 0)) return current;
  return Math.max(1, Math.round(current * (nextPrice / basePrice)));
}

/** ราคาแม่แบบย่อยทั้งชุดหลังปรับราคาหลัก
 *  · scale = false → คงราคาย่อยไว้เท่าเดิม (ผู้ดูแลเลือกเอง)
 *  · ค่าที่ว่าง/อ่านไม่ออก/ไม่เป็นบวก จะถูกตัดทิ้ง = แม่แบบย่อยนั้นกลับไปใช้ราคาของแม่แบบหลัก
 *    (กติกาเดิมของระบบ: ไม่มีคีย์ = ใช้ราคาหลัก — ห้ามบันทึก 0 ลงฐานข้อมูล) */
export function scaleSubtypePrices(
  subs: Record<string, string | number>, basePrice: number, nextPrice: number, scale = true,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, raw] of Object.entries(subs)) {
    const cur = typeof raw === "number" ? raw : parseFloat(raw);
    if (!(cur > 0)) continue;
    out[name] = scale ? scaleSubtypePrice(cur, basePrice, nextPrice) : cur;
  }
  return out;
}
