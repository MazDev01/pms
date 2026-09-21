import { describe, it, expect } from "vitest";
import { quoteExpiryISO, daysUntilISO } from "@pms/shared/lib/quoteExpiry";

// กระดิ่ง "ใบเสนอราคาใกล้หมดอายุ" กับหน้าใบเสนอราคาต้องเห็นวันหมดอายุวันเดียวกัน (21 ก.ย. 69)
describe("quoteExpiry", () => {
  it("ใบที่กรอกวันหมดอายุเองใช้ค่านั้น", () => {
    expect(quoteExpiryISO({ date: "2026-09-01", expiry: "2026-12-31" }, 30)).toBe("2026-12-31");
  });
  it("ไม่ได้กรอก = วันที่ใบ + อายุใบ", () => {
    expect(quoteExpiryISO({ date: "2026-09-01" }, 30)).toBe("2026-10-01");
  });
  it("อ่านวันไม่ได้ = ว่าง", () => {
    expect(quoteExpiryISO({ date: "" }, 30)).toBe("");
  });
  it("นับวันที่เหลือ (ติดลบ = เลยแล้ว)", () => {
    expect(daysUntilISO("2026-09-28", "2026-09-21")).toBe(7);
    expect(daysUntilISO("2026-09-20", "2026-09-21")).toBe(-1);
    expect(daysUntilISO("", "2026-09-21")).toBeNull();
  });
});
