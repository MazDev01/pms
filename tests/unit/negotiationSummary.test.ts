// สรุปการต่อรองราคาของใบเสนอราคา — ยอดตั้งต้น → ยอดปัจจุบัน · ลดกี่บาท กี่เปอร์เซ็นต์ กี่รอบ
// ประวัติมาจากฐานข้อมูล (trigger 0148) แอปแค่เอามาสรุปแสดง
import { describe, it, expect } from "vitest";
import { negotiationSummary, type PriceChange } from "../../packages/shared/lib/mock";

const h = (from: number, to: number, at = "2026-08-19T10:00:00"): PriceChange => ({ at, from, to });

describe("negotiationSummary", () => {
  it("ยังไม่เคยต่อรอง → null (หน้าจอขึ้น '—' ไม่ใช่ 0%)", () => {
    expect(negotiationSummary({ totalValue: 1_000_000 })).toBeNull();
    expect(negotiationSummary({ totalValue: 1_000_000, priceHistory: [] })).toBeNull();
  });

  it("ต่อรอง 3 รอบ — ตั้งต้นคือยอดก่อนของรอบแรก ปัจจุบันคือยอดหลังของรอบสุดท้าย", () => {
    const s = negotiationSummary({
      totalValue: 899_000,
      priceHistory: [h(1_000_000, 950_000), h(950_000, 920_000), h(920_000, 899_000)],
    })!;
    expect(s.rounds).toBe(3);
    expect(s.first).toBe(1_000_000);
    expect(s.last).toBe(899_000);
    expect(s.diff).toBe(-101_000);
    expect(s.pct).toBeCloseTo(-10.1, 5);
  });

  it("ต่อรองขึ้น (เพิ่มงาน) — ส่วนต่างเป็นบวก", () => {
    const s = negotiationSummary({ totalValue: 1_200_000, priceHistory: [h(1_000_000, 1_200_000)] })!;
    expect(s.diff).toBe(200_000);
    expect(s.pct).toBeCloseTo(20, 5);
  });

  it("ยอดตั้งต้นเป็น 0 — ไม่หารด้วยศูนย์ (คืน 0%) ", () => {
    const s = negotiationSummary({ totalValue: 500_000, priceHistory: [h(0, 500_000)] })!;
    expect(s.pct).toBe(0);
    expect(s.diff).toBe(500_000);
  });

  it("ลดแล้วขึ้นใหม่ — สรุปเทียบหัวกับท้าย ไม่ใช่ผลรวมของทุกรอบ", () => {
    const s = negotiationSummary({
      totalValue: 1_000_000,
      priceHistory: [h(1_000_000, 800_000), h(800_000, 1_000_000)],
    })!;
    expect(s.rounds).toBe(2);
    expect(s.diff).toBe(0);
    expect(s.pct).toBe(0);
  });
});
