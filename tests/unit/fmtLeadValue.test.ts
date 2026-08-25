// มูลค่าที่เซลส์ประเมินไว้ ต้องแสดงมีลูกน้ำเสมอ และไม่มีค่าต้องขึ้น "—" ไม่ใช่ ฿0
import { describe, it, expect } from "vitest";
import { fmtLeadValue } from "../../packages/shared/lib/format";

describe("fmtLeadValue", () => {
  it("เติมลูกน้ำให้เลขยาว", () => {
    expect(fmtLeadValue("5270000")).toBe("฿5,270,000");
    expect(fmtLeadValue("2790000")).toBe("฿2,790,000");
    expect(fmtLeadValue(6240000)).toBe("฿6,240,000");
  });

  it("รับรูปแบบย่อที่เซลส์พิมพ์ได้ด้วย", () => {
    expect(fmtLeadValue("1.4M")).toBe("฿1,400,000");
    expect(fmtLeadValue("480K")).toBe("฿480,000");
    expect(fmtLeadValue("฿1,234,567")).toBe("฿1,234,567");
  });

  it("ไม่มีค่า/อ่านไม่ออก → '—' ห้ามขึ้น ฿0 (0 แปลว่าไม่มีมูลค่า ซึ่งไม่จริง)", () => {
    for (const v of ["", "   ", "abcxyz", null, undefined, 0]) {
      expect(fmtLeadValue(v as string)).toBe("—");
    }
  });
});
