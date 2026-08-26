// ช่องกรอกเงินต้องเห็นลูกน้ำระหว่างพิมพ์ (บอสสั่ง 26 ส.ค. 69)
import { describe, it, expect } from "vitest";
import { formatMoneyInput, parseMoneyInput } from "../../packages/shared/lib/format";

describe("formatMoneyInput", () => {
  it("ใส่ลูกน้ำให้ตามหลัก", () => {
    expect(formatMoneyInput("42000000")).toBe("42,000,000");
    expect(formatMoneyInput("5100")).toBe("5,100");
    expect(formatMoneyInput("999")).toBe("999");
  });
  it("พิมพ์ทับของเดิมที่มีลูกน้ำแล้ว ต้องไม่เพี้ยน", () => {
    expect(formatMoneyInput("42,000,000")).toBe("42,000,000");
  });
  it("ตัวอักษรที่ไม่ใช่ตัวเลข ต้องถูกตัดทิ้ง", () => {
    expect(formatMoneyInput("฿1,234abc")).toBe("1,234");
  });
  it("ทศนิยมเก็บได้ไม่เกิน 2 ตำแหน่ง (ราคากลางมีสตางค์)", () => {
    expect(formatMoneyInput("5100.5")).toBe("5,100.5");
    expect(formatMoneyInput("5100.567")).toBe("5,100.56");
  });
  it("ศูนย์นำหน้าไม่ค้าง", () => {
    expect(formatMoneyInput("007")).toBe("7");
  });
  it("ว่าง = ว่าง", () => {
    expect(formatMoneyInput("")).toBe("");
    expect(formatMoneyInput("abc")).toBe("");
  });
});

describe("parseMoneyInput", () => {
  it("อ่านค่าจริงกลับมาได้", () => {
    expect(parseMoneyInput("42,000,000")).toBe(42_000_000);
    expect(parseMoneyInput("5,100.5")).toBe(5100.5);
  });
  it("ว่าง/อ่านไม่ออก = 0 (ไม่ใช่ NaN ที่ทำให้ยอดเพี้ยน)", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("abc")).toBe(0);
    expect(parseMoneyInput("-500")).toBe(0);
  });
});
