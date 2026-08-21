// เบอร์โทร: รับเฉพาะตัวเลข + ใส่ขีดให้เอง (บอสสั่ง 21 ส.ค. 69)
import { describe, it, expect } from "vitest";
import { formatPhone } from "../../packages/shared/lib/format";

describe("ใส่ขีดให้เบอร์โทรอัตโนมัติ", () => {
  it("มือถือ 10 หลัก = 3-3-4", () => {
    expect(formatPhone("0872421822")).toBe("087-242-1822");
  });
  it("ใส่ขีดให้ทีละช่วงระหว่างพิมพ์ ไม่ต้องรอครบ", () => {
    expect(formatPhone("087")).toBe("087");
    expect(formatPhone("0872")).toBe("087-2");
    expect(formatPhone("087242")).toBe("087-242");
    expect(formatPhone("0872421")).toBe("087-242-1");
  });
  it("เบอร์บ้านกรุงเทพขึ้นต้น 02 = 2-3-4", () => {
    expect(formatPhone("021234567")).toBe("02-123-4567");
  });

  // ── รับเฉพาะตัวเลข ──
  it("ตัวอักษร/เว้นวรรค/วงเล็บ ถูกตัดทิ้งหมด", () => {
    expect(formatPhone("08a7bc2 42(18)22")).toBe("087-242-1822");
    expect(formatPhone("โทร 087-242-1822")).toBe("087-242-1822");
  });
  it("พิมพ์เกิน 10 หลัก = ตัดทิ้ง (เบอร์ไทยยาวสุด 10 หลัก)", () => {
    expect(formatPhone("08724218229999")).toBe("087-242-1822");
  });
  it("ขีดที่ผู้ใช้พิมพ์เองไม่ทำให้เพี้ยน (ใส่ซ้ำก็ได้ผลเดิม)", () => {
    expect(formatPhone(formatPhone("0872421822"))).toBe("087-242-1822");
  });
  it("ว่าง = ว่าง (ไม่เสกขีดขึ้นมา)", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("abc")).toBe("");
  });
});
