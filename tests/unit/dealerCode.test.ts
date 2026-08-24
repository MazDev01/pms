// กติกาเติมรหัสสาขา — ต้องให้ผลเดียวกันทุกฝั่ง (ที่มา: ผลตรวจภายนอก DL-01/DL-02)
import { describe, it, expect } from "vitest";
import { dealerCodeOf } from "../../packages/shared/lib/dealerCode";
import { DEFAULT_DEALER_CODE } from "../../packages/shared/lib/mock";

describe("dealerCodeOf", () => {
  it("มีรหัสอยู่แล้ว = ใช้ค่านั้น", () => {
    expect(dealerCodeOf({ dealerCode: "RYG" })).toBe("RYG");
  });
  it("ไม่มีรหัส / ค่าว่าง / ช่องว่างล้วน = สาขาตั้งต้น (ห้ามตกหาย)", () => {
    for (const rec of [{}, { dealerCode: "" }, { dealerCode: "   " }, { dealerCode: null }, undefined, null]) {
      expect(dealerCodeOf(rec as never)).toBe(DEFAULT_DEALER_CODE);
    }
  });
  it("ผลลัพธ์ไม่มีวันเป็นค่าว่าง — ค่าว่างคือต้นเหตุที่ทำให้เรคคอร์ดหลุดจากการรวมยอด", () => {
    expect(dealerCodeOf({ dealerCode: undefined })).not.toBe("");
  });
});
