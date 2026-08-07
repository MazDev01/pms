import { describe, it, expect } from "vitest";
import { escHtml, escCsvCell } from "../../packages/shared/lib/exportSafety";

// ── ไฟล์ที่ส่งออกต้องไม่กลายเป็นช่องโจมตี ────────────────────────────────────────
// ข้อมูลในตารางมาจากสิ่งที่ผู้ใช้พิมพ์เอง (ชื่อบริษัท/ผู้ติดต่อ/หมายเหตุ) — เชื่อไม่ได้
// เดิมไม่มีการป้องกันเลย: ค่าถูกยัดลง HTML ตรง ๆ ตอนส่งออก PDF/Excel และลง CSV แบบดิบ
describe("ส่งออก PDF/Excel — ต้องไม่ให้แท็กทำงาน", () => {
  it("แปลงแท็กเป็นข้อความธรรมดา", () => {
    const out = escHtml('<img src=x onerror="alert(1)">');
    expect(out.includes("<img"), "ต้องไม่เหลือแท็กจริง").toBe(false);
    expect(out.includes("&lt;img"), "ต้องกลายเป็นข้อความ").toBe(true);
  });

  it("ปิดช่องแทรกสคริปต์ด้วยเครื่องหมายคำพูด", () => {
    const out = escHtml(`" onmouseover="alert(1)`);
    expect(out.includes('"'), "เครื่องหมายคำพูดต้องถูกแปลง").toBe(false);
  });

  it("ข้อความไทยปกติต้องไม่เพี้ยน", () => {
    expect(escHtml("บจ. เชียงใหม่สตีลบิลด์")).toBe("บจ. เชียงใหม่สตีลบิลด์");
  });
});

describe("ส่งออก CSV — ต้องไม่ให้ Excel ตีความเป็นสูตร", () => {
  it("ค่าที่ขึ้นต้นด้วยอักขระสูตร ต้องถูกบังคับเป็นข้อความ", () => {
    for (const risky of ["=WEBSERVICE(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)"]) {
      const cell = escCsvCell(risky);
      expect(cell.startsWith(`"'`), `ค่า ${risky} ต้องมี ' นำหน้า — ได้ ${cell}`).toBe(true);
    }
  });

  it("ค่าปกติต้องไม่ถูกเติมอะไรเกินมา", () => {
    expect(escCsvCell("บจ. ระยองสตีล")).toBe('"บจ. ระยองสตีล"');
    expect(escCsvCell(1250000)).toBe('"1250000"');
  });

  it("เครื่องหมายคำพูดในค่า ต้องไม่ทำให้คอลัมน์เพี้ยน", () => {
    expect(escCsvCell('บริษัท "เอ" จำกัด')).toBe('"บริษัท ""เอ"" จำกัด"');
  });
});
