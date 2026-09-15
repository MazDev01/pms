// เพดานจำนวนสาขาต่อคำขอของ /api/v1 ต้องรับเครือขนาดจริงได้
// ⚠️ บั๊กจริงบนเว็บจริง 15 ก.ย. 69: เพดานเดิม 100 · เครือมี 155 สาขา
//    หน้า /hq/leads ส่งเกณฑ์ติดตามครบทุกสาขา → 400 "perDealer มีได้ไม่เกิน 100 รายการ"
//    ตารางลูกค้าเป้าหมายทั้งเครือโหลดไม่ขึ้น + แถบ "โหลดข้อมูลบางส่วนไม่สำเร็จ"
//    บนเครื่องนักพัฒนาไม่เจอ เพราะ dev ต่อฐานข้อมูลตรง ไม่ผ่านเส้นทาง api
import { describe, it, expect } from "vitest";
import { parse, BadInput } from "../../packages/shared/server/v1/_valid";
import { LEAD_PAGE_SHAPE, QUOTE_PAGE_SHAPE, MAX_DEALERS } from "../../packages/shared/server/v1/sales";

const รหัสสาขา = (n: number) => Array.from({ length: n }, (_, i) => `D${String(i).padStart(4, "0")}`);

describe("เพดานจำนวนสาขาต่อคำขอ", () => {
  it("หน้าลูกค้าเป้าหมาย: รับเกณฑ์ติดตามและรหัสสาขาครบ 155 สาขา (ขนาดเครือจริง)", () => {
    const codes = รหัสสาขา(155);
    const f = parse(LEAD_PAGE_SHAPE, { perDealer: Object.fromEntries(codes.map(c => [c, 7])), dealerCodes: codes });
    expect(Object.keys(f.perDealer ?? {})).toHaveLength(155);
    expect(f.dealerCodes).toHaveLength(155);
  });

  it("หน้าใบเสนอราคา: รับรหัสสาขาครบ 155 สาขา", () => {
    const codes = รหัสสาขา(155);
    const f = parse(QUOTE_PAGE_SHAPE, { dealerCodes: codes, searchDealers: codes });
    expect(f.dealerCodes).toHaveLength(155);
  });

  it("ยังกันคำขอขนาดผิดปกติ (เกินเพดาน = ปฏิเสธ)", () => {
    const codes = รหัสสาขา(MAX_DEALERS + 1);
    expect(() => parse(LEAD_PAGE_SHAPE, { perDealer: Object.fromEntries(codes.map(c => [c, 7])) })).toThrow(BadInput);
  });
});
