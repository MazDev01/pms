import { describe, it, expect } from "vitest";
import {
  เตรียมบันทึกใบ, ตรวจใบเสนอ, สถานะที่เปลี่ยนไปได้, มีใบเสนอที่ส่งแล้ว, หมดอายุแล้ว, มูลค่าอ่านง่าย, ใบล็อกแล้ว,
} from "../../packages/shared/lib/dealerProposals";
import { buildDealerProposalHTML } from "../../packages/shared/lib/dealerProposalPrint";
import type { DealerPackageProposal, HQCompany } from "../../packages/shared/lib/data/types";

// ใบเสนอแพ็กเกจตัวแทน (บอสสั่ง 14 ก.ย. 69: "เหมือนดีลเลอร์ที่ต้องมีใบเสนอราคา แต่อันนี้ของ HQ")
const ใบ = (x: Partial<DealerPackageProposal>): DealerPackageProposal => ({
  id: 1, prospectId: 7, proposalNo: "DP-2026-0001", package: "standard", status: "draft", proposedDate: "2026-09-14", ...x,
});

describe("เตรียมบันทึกใบ / ตรวจใบเสนอ", () => {
  it("มูลค่า: พิมพ์มีลูกน้ำ/฿ ได้ · เว้นว่าง = null (ไม่ใช่ 0) · อ่านไม่ออก = ฟ้อง ไม่กลืนเป็น 0", () => {
    expect(เตรียมบันทึกใบ({ prospectId: 7, package: "standard", proposedDate: "2026-09-14", amount: "฿150,000" as unknown as number }).amount).toBe(150000);
    expect(เตรียมบันทึกใบ({ prospectId: 7, amount: "" as unknown as number }).amount).toBeNull();
    const เพี้ยน = เตรียมบันทึกใบ({ prospectId: 7, package: "standard", proposedDate: "2026-09-14", amount: "ห้าหมื่น" as unknown as number });
    expect(ตรวจใบเสนอ(เพี้ยน)).toMatch(/มูลค่า/);
  });

  it("ต้องเลือกแพ็กเกจเอง — ห้ามเลือกให้", () => {
    const r = เตรียมบันทึกใบ({ prospectId: 7, proposedDate: "2026-09-14" });
    expect(ตรวจใบเสนอ(r)).toMatch(/ต้องเลือกแพ็กเกจ/);
  });

  it("ต้องมีวันที่เสนอ · วันมีผลถึงต้องไม่ก่อนวันที่เสนอ · ต้องผูกลูกค้าเป้าหมาย", () => {
    expect(ตรวจใบเสนอ(เตรียมบันทึกใบ({ prospectId: 7, package: "exclusive" }))).toMatch(/วันที่เสนอ/);
    expect(ตรวจใบเสนอ(เตรียมบันทึกใบ({ prospectId: 7, package: "exclusive", proposedDate: "2026-09-14", validUntil: "2026-09-01" }))).toMatch(/ไม่ก่อนวันที่เสนอ/);
    expect(ตรวจใบเสนอ(เตรียมบันทึกใบ({ package: "exclusive", proposedDate: "2026-09-14" }))).toMatch(/ลูกค้าเป้าหมาย/);
  });

  it("พื้นที่: เติมภาคจากจังหวัด · จังหวัดต้องอยู่ในภาค (กติกาเดียวกับลูกค้าเป้าหมาย)", () => {
    expect(เตรียมบันทึกใบ({ prospectId: 7, province: "ชลบุรี" }).region).toBe("ตะวันออก");
    const ผิดภาค = เตรียมบันทึกใบ({ prospectId: 7, package: "standard", proposedDate: "2026-09-14", region: "ใต้", province: "ชลบุรี" });
    expect(ตรวจใบเสนอ(ผิดภาค)).toMatch(/ไม่ได้อยู่ในภาค/);
  });

  it("สถานะแปลก ๆ ที่ยิงเข้ามา → กลับเป็นร่าง", () => {
    expect(เตรียมบันทึกใบ({ prospectId: 7, status: "paid" as DealerPackageProposal["status"] }).status).toBe("draft");
  });
});

describe("สถานะใบ (ตรงกับตัวดักของฐานข้อมูล 0172)", () => {
  it("เดินหน้าทางเดียว — ร่างข้ามไปตอบรับไม่ได้ · ตอบรับ/ปฏิเสธแล้วจบ", () => {
    expect(สถานะที่เปลี่ยนไปได้("draft")).toEqual(["draft", "sent"]);
    expect(สถานะที่เปลี่ยนไปได้("sent")).toEqual(["sent", "accepted", "rejected"]);
    expect(สถานะที่เปลี่ยนไปได้("accepted")).toEqual(["accepted"]);
    expect(สถานะที่เปลี่ยนไปได้("rejected")).toEqual(["rejected"]);
  });
  it("ส่งแล้ว = ล็อกเนื้อหา · ร่างยังแก้ได้", () => {
    expect(ใบล็อกแล้ว("draft")).toBe(false);
    expect(ใบล็อกแล้ว("sent")).toBe(true);
  });
  it("ด่านสร้างตัวแทน: นับเฉพาะใบที่ส่งแล้วหรือตอบรับ (ร่าง/ปฏิเสธไม่นับ)", () => {
    expect(มีใบเสนอที่ส่งแล้ว([ใบ({ status: "draft" }), ใบ({ status: "rejected" })])).toBe(false);
    expect(มีใบเสนอที่ส่งแล้ว([ใบ({ status: "sent" })])).toBe(true);
    expect(มีใบเสนอที่ส่งแล้ว([ใบ({ status: "accepted" })])).toBe(true);
    expect(มีใบเสนอที่ส่งแล้ว([])).toBe(false);
  });
  it("เลยกำหนด = ส่งแล้วแต่เลยวันมีผล (ใบที่ตอบแล้วไม่นับ)", () => {
    expect(หมดอายุแล้ว(ใบ({ status: "sent", validUntil: "2026-09-01" }), "2026-09-14")).toBe(true);
    expect(หมดอายุแล้ว(ใบ({ status: "accepted", validUntil: "2026-09-01" }), "2026-09-14")).toBe(false);
    expect(หมดอายุแล้ว(ใบ({ status: "sent", validUntil: null }), "2026-09-14")).toBe(false);
  });
  it("มูลค่าไม่ได้กรอก = “—” ไม่ใช่ ฿0", () => {
    expect(มูลค่าอ่านง่าย(null)).toBe("—");
    expect(มูลค่าอ่านง่าย(150000)).toBe("฿150,000");
    expect(มูลค่าอ่านง่าย(0)).toBe("฿0");
  });
});

describe("พิมพ์ใบเสนอแพ็กเกจตัวแทน", () => {
  const hq: HQCompany = { name: "บริษัท ทดสอบสำนักงานใหญ่ จำกัด", address: "กรุงเทพฯ", taxId: "", phone: "02-000-0000", email: "", website: "" };

  it("หัวกระดาษเป็นของสำนักงานใหญ่ · มีเลขที่ แพ็กเกจ พื้นที่ มูลค่า", () => {
    const html = buildDealerProposalHTML(ใบ({ package: "exclusive", region: "ตะวันออก", province: "ชลบุรี", amount: 150000, status: "sent" }),
      { name: "คุณสมชาย" }, hq);
    expect(html).toContain("ใบเสนอแพ็กเกจตัวแทน");
    expect(html).toContain("บริษัท ทดสอบสำนักงานใหญ่ จำกัด");
    expect(html).toContain("DP-2026-0001");
    expect(html).toContain("Exclusive");
    expect(html).toContain("ชลบุรี · ภาคตะวันออก");
    expect(html).toContain("฿150,000");
    expect(html).not.toContain("ยังไม่ใช่ข้อเสนอที่ส่งจริง");   // ส่งแล้ว = ไม่มีป้ายร่าง
  });

  it("ใบร่างต้องมีป้ายบอกชัด · มูลค่าไม่ได้กรอกขึ้น “—”", () => {
    const html = buildDealerProposalHTML(ใบ({ amount: null }), { name: "คุณสมชาย" }, hq);
    expect(html).toContain("ยังไม่ใช่ข้อเสนอที่ส่งจริง");
    expect(html).toMatch(/<td class="r">—<\/td>/);
  });

  it("ค่าที่ผู้ใช้กรอกต้องไม่รันเป็นโค้ด (ชื่อ/เงื่อนไขที่มีแท็ก)", () => {
    const html = buildDealerProposalHTML(ใบ({ terms: "<script>alert(1)</script>\nข้อสอง" }), { name: "<img src=x onerror=alert(1)>" }, hq);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("• ข้อสอง");
  });

  it("ทุกภาค = ทั่วประเทศ", () => {
    expect(buildDealerProposalHTML(ใบ({ region: "ทุกภาค", province: "ทุกจังหวัด" }), { name: "ก" }, hq)).toContain("ทั่วประเทศ (ทุกภาค)");
  });
});
