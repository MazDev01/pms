// ลูกค้าเป้าหมายในช่วงเวลา = นับตาม "วันที่ลูกค้าเข้ามา" ทุกหน้า (บอสเลือก 15 ก.ย. 69)
// ⚠️ เดิมหน้าสาขานับตามวันติดต่อล่าสุด แต่ HQ นับตามวันเข้ามา → เว็บจริงช่วงเดียวกันขึ้น 187 vs 155
import { describe, it, expect } from "vitest";
import { leadEnteredInRange, leadEntryDate } from "../../packages/shared/lib/leadMetrics";
import type { LeadRow } from "../../packages/shared/lib/mock";

const lead = (createdAt: string, lastContactAt?: string) =>
  ({ numId: 1, createdAt, lastContactAt, status: "WAITING" } as unknown as LeadRow);
const start = new Date(2026, 0, 1), end = new Date(2026, 8, 15, 23, 59, 59);

describe("leadEnteredInRange", () => {
  it("นับตามวันเข้ามา ไม่ใช่วันติดต่อล่าสุด", () => {
    // เข้ามาปีก่อน แต่เพิ่งติดต่อในช่วง → ไม่นับ
    expect(leadEnteredInRange(lead("20 ธ.ค. 2568", "2026-06-01"), start, end)).toBe(false);
    // เข้ามาในช่วง แต่ติดต่อล่าสุดก่อนช่วง → นับ
    expect(leadEnteredInRange(lead("3 ม.ค. 2569", "2025-12-30"), start, end)).toBe(true);
  });

  it("วันขอบช่วงนับรวมทั้งต้นและปลาย", () => {
    expect(leadEnteredInRange(lead("1 ม.ค. 2569"), start, end)).toBe(true);
    expect(leadEnteredInRange(lead("15 ก.ย. 2569"), start, end)).toBe(true);
    expect(leadEnteredInRange(lead("16 ก.ย. 2569"), start, end)).toBe(false);
  });

  it("ไม่มีวันเข้ามา = นับรวม (ตรงกับ RPC ของ HQ) และไม่สังเคราะห์วันจาก numId", () => {
    expect(leadEntryDate(lead(""))).toBeNull();
    expect(leadEnteredInRange(lead(""), start, end)).toBe(true);
  });
});
