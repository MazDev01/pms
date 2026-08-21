// เหตุผลที่เสียโอกาสในกราฟ — ต้องโชว์ "ทุกเหตุผล" (บอสสั่ง 21 ส.ค. 69)
//
// ⚠️ เคยพลาดมาแล้ววันเดียวกัน: ยุบทุกเหตุผลที่ไม่อยู่ในรายการมาตรฐานเป็น "อื่นๆ"
//    ข้อมูลจริงส่วนใหญ่เลยกองรวมเป็นก้อนเดียว กราฟเหลือชิ้นเดียว = เสียประโยชน์ทั้งใบ
import { describe, it, expect } from "vitest";
import { groupLostReasons, withUnspecified, OTHER_REASON_LABEL, UNSPECIFIED_REASON_LABEL } from "../../packages/shared/lib/lostReasons";

const r = (reason: string, count: number, value = 0) => ({ reason, count, value });

describe("จัดกลุ่มเหตุผลที่เสียโอกาสก่อนเข้ากราฟ", () => {
  it("เหตุผลไม่เยอะ = โชว์ครบทุกอัน ไม่ยุบอะไรเลย", () => {
    const out = groupLostReasons([r("ราคาสูง", 3), r("ลูกค้าเงียบ", 2), r("เลือกคู่แข่ง", 1)]);
    expect(out.map(x => x.reason)).toEqual(["ราคาสูง", "ลูกค้าเงียบ", "เลือกคู่แข่ง"]);
    expect(out.some(x => x.reason === OTHER_REASON_LABEL)).toBe(false);
  });

  it("เรียงจากมากไปน้อยเสมอ", () => {
    const out = groupLostReasons([r("น้อย", 1), r("มาก", 9), r("กลาง", 4)]);
    expect(out.map(x => x.count)).toEqual([9, 4, 1]);
  });

  it("เกินจำนวนชิ้นที่อ่านไหว → ยุบเฉพาะหางยาวเป็นก้อนเดียว", () => {
    const out = groupLostReasons(
      [r("a", 10), r("b", 9), r("c", 8), r("d", 7), r("e", 6), r("f", 5), r("g", 4), r("h", 3)], 6);
    expect(out.length, "ต้องเหลือ 6 ชิ้นพอดี").toBe(6);
    expect(out.slice(0, 5).map(x => x.reason)).toEqual(["a", "b", "c", "d", "e"]);
    const อื่นๆ = out[5];
    expect(อื่นๆ.reason).toBe(OTHER_REASON_LABEL);
    expect(อื่นๆ.count, "ก้อนอื่นๆ ต้องรวมยอดของหางทั้งหมด").toBe(5 + 4 + 3);
    expect(อื่นๆ.details, "ต้องพกข้อความจริงไว้ให้ชี้เมาส์ดูได้").toEqual(["f (5)", "g (4)", "h (3)"]);
  });

  it("ยอดรวมต้องไม่หายไปไหนหลังยุบ", () => {
    const src = [r("a", 5, 100), r("b", 4, 90), r("c", 3, 80), r("d", 2, 70), r("e", 1, 60), r("f", 1, 50), r("g", 1, 40)];
    const out = groupLostReasons(src, 4);
    expect(out.reduce((s, x) => s + x.count, 0)).toBe(src.reduce((s, x) => s + x.count, 0));
    expect(out.reduce((s, x) => s + x.value, 0)).toBe(src.reduce((s, x) => s + x.value, 0));
  });

  it("เหตุผลว่างเปล่าถูกตัดทิ้ง (ไม่ใช่ชิ้นไร้ชื่อในกราฟ)", () => {
    expect(groupLostReasons([r("", 3), r("  ", 2), r("จริง", 1)]).map(x => x.reason)).toEqual(["จริง"]);
  });
});

describe('ก้อน "อื่นๆ (ไม่ได้ระบุเหตุผล)" ในกราฟ', () => {
  it("มีดีลที่ไม่ได้ระบุเหตุผล → ต้องมีชิ้นของมันในกราฟ", () => {
    const out = withUnspecified([{ reason: "ราคาสูง", count: 5, value: 0 }], 3);
    expect(out.at(-1)?.reason).toBe(UNSPECIFIED_REASON_LABEL);
    expect(out.at(-1)?.count).toBe(3);
  });
  it("ผลรวมของชิ้นต้องเท่ากับจำนวนที่ปิดไม่สำเร็จทั้งหมด (เลขกลางวง)", () => {
    const มีเหตุผล = [{ reason: "a", count: 5, value: 0 }, { reason: "b", count: 4, value: 0 }];
    const out = withUnspecified(มีเหตุผล, 7);
    expect(out.reduce((s, r) => s + r.count, 0)).toBe(16);
  });
  it("ไม่มีดีลที่ไม่ได้ระบุ → ห้ามใส่ชิ้นเปล่า", () => {
    const out = withUnspecified([{ reason: "a", count: 2, value: 0 }], 0);
    expect(out.some(r => r.reason === UNSPECIFIED_REASON_LABEL)).toBe(false);
  });
  it('คนละก้อนกับ "อื่นๆ" ที่มาจากการยุบหางยาว — ต้องแยกกันได้', () => {
    expect(UNSPECIFIED_REASON_LABEL).not.toBe(OTHER_REASON_LABEL);
  });
});
