import { describe, it, expect } from "vitest";
import { toCamel, toSnake, toCamelList, toSnakeList } from "../../packages/shared/lib/data/supabase/mappers";

// DB ใช้ snake_case (dealer_code, num_id) · type ในแอปใช้ camelCase — ผิดพลาดตรงนี้ = ข้อมูลเพี้ยนทั้งระบบ
describe("toCamel — snake_case → camelCase (ระดับคอลัมน์)", () => {
  it("แปลงคีย์ธรรมดา + คีย์ที่มีตัวเลข (num_id)", () => {
    expect(toCamel({ dealer_code: "CNX", num_id: 7 })).toEqual({ dealerCode: "CNX", numId: 7 });
  });
  it("คีย์ที่ไม่มี _ คงเดิม", () => {
    expect(toCamel({ id: 1, name: "a" })).toEqual({ id: 1, name: "a" });
  });
  it("ค่า jsonb (nested) ปล่อยผ่านคงรูป — แปลงเฉพาะคีย์บนสุด", () => {
    const items = [{ line_no: 1 }];
    const out = toCamel<{ lineItems: unknown }>({ line_items: items });
    expect(out.lineItems).toBe(items); // อ้างอิงเดิม ไม่แตะข้างใน
  });
  it("object ว่าง → ว่าง", () => {
    expect(toCamel({})).toEqual({});
  });
});

describe("toSnake — camelCase → snake_case", () => {
  it("แปลงกลับ", () => {
    expect(toSnake({ dealerCode: "CNX", numId: 7 })).toEqual({ dealer_code: "CNX", num_id: 7 });
  });
  it("ตัวพิมพ์ใหญ่ติดกันแตกเป็น _ ทีละตัว (ตามพฤติกรรมจริง)", () => {
    expect(toSnake({ aBC: 1 })).toEqual({ a_b_c: 1 });
  });
});

describe("round-trip", () => {
  it("snake → camel → snake ได้ค่าเดิม", () => {
    const row = { dealer_code: "RYG", num_id: 3, total_value: 100, name: "x" };
    expect(toSnake(toCamel(row))).toEqual(row);
  });
});

describe("list helpers", () => {
  it("toCamelList / toSnakeList map ทุกแถว", () => {
    expect(toCamelList([{ dealer_code: "A" }, { dealer_code: "B" }])).toEqual([{ dealerCode: "A" }, { dealerCode: "B" }]);
    expect(toSnakeList([{ dealerCode: "A" }])).toEqual([{ dealer_code: "A" }]);
  });
});
