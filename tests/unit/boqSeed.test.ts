import { describe, it, expect } from "vitest";
import { seedLineItems, boqSubtotal } from "../../packages/shared/lib/boq";
import type { SolutionProduct } from "../../packages/shared/lib/mock";

// ── BOQ ตั้งต้นของใบเสนอราคาใหม่ ────────────────────────────────────────────────
//
// บั๊กที่กัน (ผู้ใช้แจ้ง 11 ส.ค. 69 · "ไม่มีตัวแม่แบบขึ้นมา"):
//   เปิดลูกค้าเป้าหมายที่ระบุแม่แบบ "โรงยิมอเนกประสงค์" และมูลค่า ฿155K ไว้ครบ
//   กด "สร้างใบเสนอราคาใหม่" แล้วตาราง BOQ ว่างเปล่า ขึ้นว่า "ระบุแม่แบบและมูลค่าประเมินก่อน"
//   ทั้งที่ระบุไว้แล้วทั้งคู่
//
// เหตุ: แคตตาล็อกราคากลางโหลดแบบไม่พร้อมหน้า (เริ่มด้วยรายการว่างเสมอ) ถ้าฟอร์มคิด BOQ
//   ตอนที่แคตตาล็อกยังว่าง จะได้ราคากลาง 0 → ไม่มีรายการ · และหน้านั้นซ่อนปุ่มเลือกแคตตาล็อกไว้
//   ผู้ใช้จึงเพิ่มแถวเองไม่ได้เลย = ออกใบไม่ได้
//
// ตรงนี้ทดสอบตัวคิด BOQ ตรง ๆ ส่วนการ "คิดใหม่เมื่อแคตตาล็อกมาถึง" อยู่ที่ LeadQuotationsPanel
const prod = (name: string, price: number, subtypes: string[] = []): SolutionProduct => ({
  id: name, name, spec: "", price, unit: "ตร.ม.", effectiveDate: "2026-01-01", priceHistory: [], subtypes,
});
const CATALOG: SolutionProduct[] = [
  prod("สนามกีฬาในร่ม", 7400, ["โรงยิมอเนกประสงค์", "สนามแบดมินตัน"]),
  prod("โกดังสำเร็จรูป", 5100),
];

describe("BOQ ตั้งต้น — จับคู่แม่แบบกับราคากลาง", () => {
  it("แม่แบบย่อยต้องหาเจอ และคิดจำนวนจากมูลค่าประเมิน ÷ ราคากลาง", () => {
    const items = seedLineItems({ product: "โรงยิมอเนกประสงค์", value: "฿155K" }, CATALOG);
    expect(items.length, "ต้องได้ 1 รายการ ไม่ใช่ว่างเปล่า").toBe(1);
    expect(items[0].unitPrice, "ราคา/หน่วย = ราคากลางของแม่แบบหลัก").toBe(7400);
    expect(items[0].qty, "จำนวน = 155,000 ÷ 7,400 ปัดเป็น 21").toBe(21);
    expect(items[0].unit).toBe("ตร.ม.");
  });

  it("แม่แบบชื่อหลักก็ต้องหาเจอ", () => {
    const items = seedLineItems({ product: "โกดังสำเร็จรูป", value: "1,020,000" }, CATALOG);
    expect(items[0].unitPrice).toBe(5100);
    expect(items[0].qty).toBe(200);
  });

  it("มีพื้นที่กรอกไว้ → ใช้พื้นที่จริง ไม่ใช่ค่าที่ถอดจากมูลค่า", () => {
    const items = seedLineItems({ product: "โรงยิมอเนกประสงค์", value: "฿155K", area: 300 }, CATALOG);
    expect(items[0].qty, "พื้นที่จริงเชื่อถือได้กว่าการถอดกลับจากมูลค่า").toBe(300);
    expect(boqSubtotal(items)).toBe(300 * 7400);
  });
});

describe("BOQ ตั้งต้น — กรณีที่ยังปั้นไม่ได้ ต้องคืนว่าง ไม่ใช่แถวที่มีเลข 0", () => {
  it("แคตตาล็อกยังโหลดไม่เสร็จ (ว่าง) → คืนว่าง", () => {
    expect(seedLineItems({ product: "โรงยิมอเนกประสงค์", value: "฿155K" }, [])).toEqual([]);
  });

  it("ไม่ได้ระบุแม่แบบ → คืนว่าง", () => {
    expect(seedLineItems({ product: "", value: "฿155K" }, CATALOG)).toEqual([]);
  });

  it("แม่แบบไม่มีในแคตตาล็อก → คืนว่าง ไม่ใช่ราคา 0", () => {
    expect(seedLineItems({ product: "อาคารที่ยังไม่มีในแคตตาล็อก", value: "฿155K" }, CATALOG)).toEqual([]);
  });

  it("ไม่มีทั้งมูลค่าและพื้นที่ → คืนว่าง", () => {
    expect(seedLineItems({ product: "โรงยิมอเนกประสงค์" }, CATALOG)).toEqual([]);
  });

  // มูลค่าน้อยกว่าราคากลางครึ่งหนึ่งเคยถูกปัดลงเป็น 0 แล้วคืนตารางว่าง
  // ซึ่งเป็นทางตันเหมือนบั๊กหลัก (เพิ่มแถวเองไม่ได้) — ต้องได้ 1 หน่วยให้แก้ต่อได้
  it.each(["5000", "3000", "100"])("มูลค่า %s น้อยกว่าราคากลาง 1 หน่วย → ต้องได้ 1 หน่วย ไม่ใช่ตารางว่าง", (v) => {
    const items = seedLineItems({ product: "โรงยิมอเนกประสงค์", value: v }, CATALOG);
    expect(items.length, "ต้องมีแถวให้แก้ต่อได้ ไม่ใช่ทางตัน").toBe(1);
    expect(items[0].qty).toBe(1);
  });
});
