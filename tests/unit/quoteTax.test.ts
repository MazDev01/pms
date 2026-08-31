import { describe, it, expect } from "vitest";
import { คิดภาษีใบเสนอราคา, ช่องภาษีสำหรับบันทึก } from "../../packages/shared/lib/quoteTax";

// ── สูตรภาษีของใบเสนอราคา (บอสสั่ง 28 ส.ค. 69) ────────────────────────────────
// ล็อกไว้ให้ตัวเลขบนจอ · บนกระดาษ · ในฐานข้อมูล ตรงกันตลอดไป
describe("คิดภาษีใบเสนอราคา", () => {
  it("VAT 7% + หัก ณ ที่จ่าย 3% — ตามตัวอย่างที่บอสให้มา", () => {
    const t = คิดภาษีใบเสนอราคา(1_000_000, { vatPercent: 7, whtPercent: 3 });
    expect(t.subtotal).toBe(1_000_000);
    expect(t.vatAmount).toBe(70_000);
    expect(t.totalAmount).toBe(1_070_000);
    expect(t.whtAmount).toBe(30_000);      // คิดจากยอดก่อน VAT ไม่ใช่ยอดรวม
    expect(t.netPayable).toBe(1_040_000);
  });

  it("ปิด VAT = ไม่มี VAT และยอดรวมเท่ากับมูลค่างาน", () => {
    const t = คิดภาษีใบเสนอราคา(500_000, { vatPercent: 0, whtPercent: 3 });
    expect(t.vatAmount).toBe(0);
    expect(t.totalAmount).toBe(500_000);
    expect(t.whtAmount).toBe(15_000);
    expect(t.netPayable).toBe(485_000);
  });

  it("ปิดทั้งคู่ = ยอดชำระสุทธิเท่ากับมูลค่างาน", () => {
    const t = คิดภาษีใบเสนอราคา(250_000, {});
    expect(t.vatAmount).toBe(0);
    expect(t.whtAmount).toBe(0);
    expect(t.netPayable).toBe(250_000);
  });

  it("อัตราอื่นที่ไม่ใช่ 7/3 ก็ต้องคิดถูก (แก้อัตราได้ในฟอร์ม)", () => {
    const t = คิดภาษีใบเสนอราคา(120_000, { vatPercent: 10, whtPercent: 5 });
    expect(t.vatAmount).toBe(12_000);
    expect(t.totalAmount).toBe(132_000);
    expect(t.whtAmount).toBe(6_000);
    expect(t.netPayable).toBe(126_000);
  });

  it("ปัดเป็นสตางค์ทีละบรรทัด — บวกตามที่พิมพ์บนกระดาษแล้วต้องตรง", () => {
    const t = คิดภาษีใบเสนอราคา(333_333.33, { vatPercent: 7, whtPercent: 3 });
    expect(t.vatAmount).toBe(23_333.33);
    expect(t.totalAmount).toBe(356_666.66);
    expect(t.whtAmount).toBe(10_000);
    expect(t.netPayable).toBe(346_666.66);
    // บวกเองแล้วต้องได้เท่ากับที่ระบบพิมพ์ (ปัดเป็นสตางค์เหมือนกัน — เลขทศนิยมของคอมพิวเตอร์
    // บวกกันตรง ๆ จะได้ 356666.66000000003 ซึ่งเป็นข้อจำกัดของเครื่อง ไม่ใช่ยอดผิด)
    const สตางค์ = (v: number) => Math.round(v * 100) / 100;
    expect(สตางค์(t.subtotal + t.vatAmount)).toBe(t.totalAmount);
    expect(สตางค์(t.totalAmount - t.whtAmount)).toBe(t.netPayable);
  });

  it("ค่าติดลบ/ค่าเพี้ยน ต้องไม่ทำให้ยอดพัง", () => {
    const t = คิดภาษีใบเสนอราคา(100_000, { vatPercent: -5, whtPercent: Number.NaN });
    expect(t.vatRate).toBe(0);
    expect(t.whtRate).toBe(0);
    expect(t.netPayable).toBe(100_000);
    expect(คิดภาษีใบเสนอราคา(100_000, { vatPercent: 999 }).vatRate).toBe(100);
  });

  it("ช่องที่บันทึกลงฐานข้อมูลต้องครบและไม่แตะยอดขายเดิม", () => {
    const f = ช่องภาษีสำหรับบันทึก(1_000_000, { vatPercent: 7, whtPercent: 3 });
    expect(f).toEqual({
      vatPercent: 7, vatAmount: 70_000, whtRate: 3, whtAmount: 30_000,
      totalAmount: 1_070_000, netPayable: 1_040_000,
    });
    expect(Object.keys(f)).not.toContain("totalValue");   // ยอดขายเดิมห้ามถูกแตะ
  });
});
