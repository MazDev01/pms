// เปอร์เซ็นต์ในการ์ดเดียวกันต้องรวมได้ 100 พอดี (ที่มา: ผลตรวจภายนอก DL-08 — ของจริงขึ้น 103%)
import { describe, it, expect } from "vitest";
import { percentShare } from "../../packages/shared/lib/percentShare";

describe("percentShare", () => {
  it("เคสจริงที่เคยขึ้น 103% (4,2,2,2,2,2,2 จาก 16) ต้องรวมได้ 100", () => {
    const out = percentShare([4, 2, 2, 2, 2, 2, 2]);
    expect(out.reduce((s, v) => s + v, 0)).toBe(100);
    expect(out[0]).toBeGreaterThan(out[1]);   // ก้อนใหญ่ต้องยังใหญ่กว่าเสมอ
  });
  it("แบ่งสามส่วนเท่ากันต้องรวมได้ 100 (ไม่ใช่ 99)", () => {
    expect(percentShare([1, 1, 1]).reduce((s, v) => s + v, 0)).toBe(100);
  });
  it("ไม่มีข้อมูล = 0 ทุกก้อน ห้ามหารด้วยศูนย์แล้วได้ NaN", () => {
    expect(percentShare([0, 0])).toEqual([0, 0]);
    expect(percentShare([])).toEqual([]);
  });
  it("ค่าติดลบถือเป็นศูนย์ ไม่ทำให้ผลรวมเพี้ยน", () => {
    const out = percentShare([-5, 10, 10]);
    expect(out[0]).toBe(0);
    expect(out.reduce((s, v) => s + v, 0)).toBe(100);
  });
});
