// ประเมินราคาของลูกค้าเป้าหมาย = พื้นที่ × ราคาขายของสาขา (บอสสั่ง 20 ส.ค. 69)
// "แล้วเอามูลค่ามาจากไหน" — เดิมมาจากช่องที่เซลส์กรอกเองล้วน ๆ ไม่กรอกก็ไม่มีมูลค่า
// ตอนนี้คิดให้เป็นค่าตั้งต้นจากข้อมูลที่มีอยู่แล้ว แต่ยังพิมพ์ทับได้เสมอ
import { describe, it, expect } from "vitest";
import { estimateLeadValue } from "../../packages/shared/lib/boq";
import type { SolutionProduct } from "../../packages/shared/lib/mock";

const แม่แบบ = (over: Partial<SolutionProduct> = {}): SolutionProduct => ({
  id: "T-1", name: "โรงงาน", spec: "", price: 6800, unit: "ตร.ม.",
  effectiveDate: "1 ม.ค. 2569", priceHistory: [], ...over,
} as SolutionProduct);

const catalog = [แม่แบบ({ subtypes: ["โรงงานอาหาร"], subtypePrices: { "โรงงานอาหาร": 7200 } })];

describe("ประเมินราคาจากพื้นที่ × ราคาขาย", () => {
  it("แม่แบบหลัก: พื้นที่ × ราคากลาง เมื่อยังไม่ตั้งส่วนบวกเพิ่ม", () => {
    expect(estimateLeadValue("โรงงาน", 125, catalog)).toBe(850_000);
  });
  it("บวกเพิ่ม 20% ต้องคิดจากราคาขายของสาขา ไม่ใช่ราคากลาง", () => {
    expect(estimateLeadValue("โรงงาน", 125, catalog, { defaultPct: 20 })).toBe(1_020_000);
  });
  it("แม่แบบย่อยที่ตั้งราคาเอง ใช้ราคาของตัวเอง", () => {
    expect(estimateLeadValue("โรงงานอาหาร", 125, catalog)).toBe(900_000);
  });

  // ── คิดไม่ได้ = 0 ให้หน้าจอขึ้น "—" · ห้ามคืนเลขมั่ว (กติกาห้ามกุข้อมูล) ──
  it("ไม่มีพื้นที่ = คิดไม่ได้", () => {
    expect(estimateLeadValue("โรงงาน", undefined, catalog)).toBe(0);
    expect(estimateLeadValue("โรงงาน", 0, catalog)).toBe(0);
  });
  it("ยังไม่เลือกแม่แบบ = คิดไม่ได้", () => {
    expect(estimateLeadValue("", 125, catalog)).toBe(0);
  });
  it("แม่แบบที่ไม่ได้ขายเป็น ตร.ม. (เช่นเป็นหลัง) ห้ามเอาพื้นที่ไปคูณ", () => {
    expect(estimateLeadValue("บ้านน็อคดาวน์", 125, [แม่แบบ({ name: "บ้านน็อคดาวน์", unit: "หลัง" })])).toBe(0);
  });
  it("สำนักงานใหญ่ยังไม่ตั้งราคากลาง = คิดไม่ได้ (ไม่ใช่ 0 บาทที่ดูเหมือนของฟรี)", () => {
    expect(estimateLeadValue("โรงงาน", 125, [แม่แบบ({ price: 0 })], { defaultPct: 30 })).toBe(0);
  });
  it("ไม่มีแม่แบบนี้ในแคตตาล็อก = คิดไม่ได้", () => {
    expect(estimateLeadValue("อะไรไม่รู้", 125, catalog)).toBe(0);
  });
});
