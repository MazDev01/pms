import { describe, it, expect } from "vitest";
import { friendlyError, DbError } from "../../packages/shared/lib/friendlyError";

// ── ข้อความผิดพลาดที่ผู้ใช้เห็น ต้องอ่านรู้เรื่อง ไม่มีรหัสฝั่งโค้ดโผล่มา ────────────
describe("แปลข้อความผิดพลาดให้ผู้ใช้", () => {
  it("ตัดรหัสข้อผิดพลาดที่ RPC ติดหน้ามาออก", () => {
    expect(friendlyError(new Error("no_sent_quotation: ปิดการขายสำเร็จไม่ได้ — ยังไม่มีใบเสนอราคาที่ส่งถึงลูกค้า")))
      .toBe("ปิดการขายสำเร็จไม่ได้ — ยังไม่มีใบเสนอราคาที่ส่งถึงลูกค้า");
    expect(friendlyError(new Error("id_conflict:leads:3"))).not.toContain("id_conflict:");
  });

  it("ข้อความไทยล้วนใช้ตามเดิม ไม่ถูกตัดผิด", () => {
    const m = "ต้นทางและปลายทางต้องคนละสาขา";
    expect(friendlyError(new Error(m))).toBe(m);
  });

  it("เวลา 10:30 ในข้อความต้องไม่ถูกมองว่าเป็นรหัสแล้วโดนตัด", () => {
    const m = "บันทึกไม่สำเร็จเมื่อ 10:30 น.";
    expect(friendlyError(new Error(m))).toBe(m);
  });

  it("รหัสฐานข้อมูลถูกแปลเป็นไทย", () => {
    expect(friendlyError(new DbError("duplicate key", "23505"))).toContain("มีข้อมูลนี้อยู่แล้ว");
    expect(friendlyError(new DbError("fk", "23503"))).toContain("ยังมีข้อมูลอื่นผูกอยู่");
  });
});
