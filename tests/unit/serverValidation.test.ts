// สัญญาโครงสร้างข้อมูลขาเข้าของ /api/v1 — ผิดรูปต้องถูกปฏิเสธก่อนแตะฐานข้อมูล
// (S-3 จากผลตรวจระบบ 19 ส.ค. 69 · ดู packages/shared/server/v1/_valid.ts)
import { describe, it, expect } from "vitest";
import {
  parse, str, num, bool, oneOf, arrOf, mapOfNum, isoDate, BadInput,
} from "../../packages/shared/server/v1/_valid";

const โยน = (fn: () => unknown) => expect(fn).toThrow(BadInput);

describe("ข้อความ (str)", () => {
  it("ตัดช่องว่างหัวท้าย และบังคับให้มีค่าเมื่อไม่ใช่ช่องเสริม", () => {
    expect(str()("  ก  ", "ชื่อ")).toBe("ก");
    โยน(() => str()("", "ชื่อ"));
    โยน(() => str()(undefined, "ชื่อ"));
    expect(str({ optional: true })(undefined, "ชื่อ")).toBe("");
  });
  it("ยาวเกินเพดาน = ปฏิเสธ (กันยัดข้อความขนาดใหญ่เข้าฐาน)", () => {
    โยน(() => str({ max: 5 })("123456", "ชื่อ"));
  });
  it("ไม่ใช่ข้อความ = ปฏิเสธ ไม่แปลงให้เอง", () => {
    โยน(() => str()({ a: 1 }, "ชื่อ"));
    โยน(() => str()(123, "ชื่อ"));
  });
});

describe("ตัวเลข (num)", () => {
  it("รับข้อความที่เป็นตัวเลขได้ (query string ส่งมาเป็นข้อความเสมอ)", () => {
    expect(num()("42", "limit")).toBe(42);
  });
  it("นอกช่วง / ไม่ใช่จำนวนเต็ม / ไม่ใช่ตัวเลข = ปฏิเสธ", () => {
    โยน(() => num({ min: 1, max: 100 })(0, "limit"));
    โยน(() => num({ min: 1, max: 100 })(101, "limit"));
    โยน(() => num({ int: true })(1.5, "limit"));
    โยน(() => num()("abc", "limit"));
    โยน(() => num()(Infinity, "limit"));
  });
  it("ไม่ส่งมาแต่มีค่าตั้งต้น = ใช้ค่าตั้งต้น", () => {
    expect(num({ def: 50 })(undefined, "limit")).toBe(50);
  });
});

describe("ใช่/ไม่ใช่ (bool)", () => {
  it('รับทั้ง boolean และข้อความ "true"/"1"', () => {
    expect(bool()(true, "overdue")).toBe(true);
    expect(bool()("1", "overdue")).toBe(true);
    expect(bool()("false", "overdue")).toBe(false);
    expect(bool()(undefined, "overdue")).toBe(false);
    โยน(() => bool()("ใช่มั้ง", "overdue"));
  });
});

describe("ค่าในชุดที่กำหนด (oneOf)", () => {
  const สถานะ = ["WAITING", "PAID"] as const;
  it("ค่านอกชุด = ปฏิเสธ (กันค่าแปลกไปถึง enum ของฐานข้อมูล)", () => {
    expect(oneOf(สถานะ)("PAID", "status")).toBe("PAID");
    โยน(() => oneOf(สถานะ)("DROP TABLE", "status"));
  });
});

describe("รายการ (arrOf) และชุดค่า (mapOfNum)", () => {
  it("ไม่ใช่รายการ / เกินจำนวนที่ยอม = ปฏิเสธ", () => {
    expect(arrOf(str())(["CNX", "RYG"], "dealerCodes")).toEqual(["CNX", "RYG"]);
    โยน(() => arrOf(str())("CNX", "dealerCodes"));
    โยน(() => arrOf(str(), { max: 1 })(["a", "b"], "dealerCodes"));
  });
  it("ชุดค่าที่ค่าไม่ใช่ตัวเลข = ปฏิเสธ", () => {
    expect(mapOfNum()({ CNX: 7 }, "perDealer")).toEqual({ CNX: 7 });
    โยน(() => mapOfNum()({ CNX: "เจ็ด" }, "perDealer"));
    โยน(() => mapOfNum()([1, 2], "perDealer"));
  });
});

describe("วันที่ (isoDate)", () => {
  it("รับเฉพาะรูปแบบ ปี-เดือน-วัน", () => {
    expect(isoDate()("2026-08-19", "dateStart")).toBe("2026-08-19");
    โยน(() => isoDate()("19/08/2569", "dateStart"));
    expect(isoDate({ optional: true })(undefined, "dateStart")).toBeNull();
  });
});

describe("ตรวจทั้งชุด (parse)", () => {
  const shape = { limit: num({ int: true, min: 1, max: 100, def: 50 }), search: str({ max: 10, optional: true }) };
  it("ช่องที่ไม่ได้ประกาศถูกตัดทิ้ง — เส้นทางรับเฉพาะสิ่งที่ตั้งใจรับ", () => {
    const out = parse(shape, { limit: 10, search: "ก", แอบใส่: "อันตราย" });
    expect(out).toEqual({ limit: 10, search: "ก" });
    expect("แอบใส่" in out).toBe(false);
  });
  it("ไม่ส่งอะไรมาเลย = ได้ค่าตั้งต้น ไม่ระเบิด", () => {
    expect(parse(shape, null)).toEqual({ limit: 50, search: "" });
  });
  it("ช่องเดียวผิดก็ปฏิเสธทั้งชุด และบอกชื่อช่องที่ผิด", () => {
    expect(() => parse(shape, { limit: 9999 })).toThrow(/limit/);
  });
});
