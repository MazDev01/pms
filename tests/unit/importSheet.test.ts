import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  แยกตารางจากข้อความ, แยกตารางจากXlsx, จับคู่ตามหัวตาราง, เลขคอลัมน์, นามสกุลที่รับได้,
} from "../../packages/shared/lib/importSheet";

/* ── สร้างไฟล์ .xlsx ของจริงขึ้นมาทดสอบ (zip + XML) ──────────────────
   ต้องเป็นไฟล์จริง ไม่ใช่ mock — ไม่งั้นเทสต์จะผ่านทั้งที่ตัวอ่านไฟล์พัง */
function สร้างXlsx(files: Record<string, string>, บีบ = true): ArrayBuffer {
  const enc = new TextEncoder();
  const ก้อน: Buffer[] = []; const สารบัญ: Buffer[] = [];
  let ตำแหน่ง = 0;
  for (const [ชื่อ, เนื้อ] of Object.entries(files)) {
    const ดิบ = Buffer.from(enc.encode(เนื้อ));
    const บีบแล้ว = บีบ ? deflateRawSync(ดิบ) : ดิบ;
    const ชื่อไบต์ = Buffer.from(enc.encode(ชื่อ));
    const หัว = Buffer.alloc(30);
    หัว.writeUInt32LE(0x04034b50, 0); หัว.writeUInt16LE(บีบ ? 8 : 0, 8);
    หัว.writeUInt32LE(0, 14); หัว.writeUInt32LE(บีบแล้ว.length, 18); หัว.writeUInt32LE(ดิบ.length, 22);
    หัว.writeUInt16LE(ชื่อไบต์.length, 26);
    ก้อน.push(หัว, ชื่อไบต์, บีบแล้ว);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(บีบ ? 8 : 0, 10);
    cd.writeUInt32LE(บีบแล้ว.length, 20); cd.writeUInt32LE(ดิบ.length, 24);
    cd.writeUInt16LE(ชื่อไบต์.length, 28); cd.writeUInt32LE(ตำแหน่ง, 42);
    สารบัญ.push(cd, ชื่อไบต์);
    ตำแหน่ง += 30 + ชื่อไบต์.length + บีบแล้ว.length;
  }
  const cdBuf = Buffer.concat(สารบัญ);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(ตำแหน่ง, 16);
  const ทั้งไฟล์ = Buffer.concat([...ก้อน, cdBuf, eocd]);
  return ทั้งไฟล์.buffer.slice(ทั้งไฟล์.byteOffset, ทั้งไฟล์.byteOffset + ทั้งไฟล์.byteLength) as ArrayBuffer;
}

const แผ่นตัวอย่าง = `<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
  <row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>
  <row r="3"><c r="A3" t="inlineStr"><is><t>หจก. สองพี่น้อง</t></is></c><c r="B3"><v>82222222</v></c></row>
</sheetData></worksheet>`;
const คลังตัวอย่าง = `<sst><si><t>บริษัท</t></si><si><t>โทรศัพท์</t></si><si><t>จังหวัด</t></si>` +
  `<si><t>บจ. เก่า, จำกัด</t></si><si><t>ระยอง</t></si></sst>`;

describe("อ่านไฟล์ตารางจากระบบเก่า", () => {
  it("CSV: ลูกน้ำที่อยู่ในเครื่องหมายคำพูดต้องไม่ทำให้ชื่อขาด", () => {
    const t = แยกตารางจากข้อความ('บริษัท,จังหวัด\n"บจ. เก่า, จำกัด",ระยอง\n');
    expect(t).toEqual([["บริษัท", "จังหวัด"], ["บจ. เก่า, จำกัด", "ระยอง"]]);
  });

  it("CSV: เครื่องหมายคำพูดซ้อน (\"\") = อัญประกาศตัวจริง", () => {
    expect(แยกตารางจากข้อความ('a,"เขาเรียก ""ตี๋"" ",c')[0][1]).toBe('เขาเรียก "ตี๋"');
  });

  it("เดาตัวคั่นให้เอง — Tab และ ; ที่ Excel ไทยบางเครื่องส่งออก", () => {
    expect(แยกตารางจากข้อความ("บริษัท\tจังหวัด\nบจ. ก\tระยอง")).toEqual([["บริษัท", "จังหวัด"], ["บจ. ก", "ระยอง"]]);
    expect(แยกตารางจากข้อความ("บริษัท;จังหวัด\nบจ. ก;ระยอง")).toEqual([["บริษัท", "จังหวัด"], ["บจ. ก", "ระยอง"]]);
  });

  it("ทิ้งแถวว่างท้ายไฟล์ และตัด BOM ที่ Excel ใส่มา", () => {
    expect(แยกตารางจากข้อความ("﻿บริษัท\nบจ. ก\n\n\n")).toEqual([["บริษัท"], ["บจ. ก"]]);
  });

  it("ตำแหน่งช่องแบบ A1 → เลขคอลัมน์", () => {
    expect([เลขคอลัมน์("A"), เลขคอลัมน์("Z"), เลขคอลัมน์("AA"), เลขคอลัมน์("AB")]).toEqual([0, 25, 26, 27]);
  });

  it("xlsx: อ่านคลังข้อความ ช่องแบบ inline และตัวเลขได้", async () => {
    const t = await แยกตารางจากXlsx(สร้างXlsx({
      "xl/sharedStrings.xml": คลังตัวอย่าง, "xl/worksheets/sheet1.xml": แผ่นตัวอย่าง,
    }));
    expect(t[0]).toEqual(["บริษัท", "โทรศัพท์", "จังหวัด"]);
    expect(t[2]).toEqual(["หจก. สองพี่น้อง", "82222222"]);
  });

  it("xlsx: ช่องที่ Excel ข้ามไปต้องกลายเป็นช่องว่าง ไม่ใช่ทำให้คอลัมน์เลื่อน", async () => {
    const t = await แยกตารางจากXlsx(สร้างXlsx({
      "xl/sharedStrings.xml": คลังตัวอย่าง, "xl/worksheets/sheet1.xml": แผ่นตัวอย่าง,
    }));
    expect(t[1]).toEqual(["บจ. เก่า, จำกัด", "", "ระยอง"]);   // B2 ว่าง → ระยองต้องยังอยู่คอลัมน์ที่ 3
  });

  it("xlsx: ไฟล์ที่เก็บแบบไม่บีบอัดก็อ่านได้", async () => {
    const t = await แยกตารางจากXlsx(สร้างXlsx({
      "xl/sharedStrings.xml": คลังตัวอย่าง, "xl/worksheets/sheet1.xml": แผ่นตัวอย่าง,
    }, false));
    expect(t[0][0]).toBe("บริษัท");
  });

  it("ไฟล์ที่ไม่ใช่ zip ต้องฟ้องชัด ไม่ใช่คืนตารางว่างเงียบ ๆ", async () => {
    await expect(แยกตารางจากXlsx(new TextEncoder().encode("ไม่ใช่ zip").buffer as ArrayBuffer))
      .rejects.toThrow(/xlsx/);
  });
});

describe("จับคู่คอลัมน์ตามหัวตาราง", () => {
  const ชื่อคอลัมน์ = {
    company: ["บริษัท", "company"], name: ["ผู้ติดต่อ", "contact"], phone: ["โทรศัพท์", "phone"],
  };

  it("ลำดับคอลัมน์จากระบบเก่าไม่ต้องตรงกับเทมเพลต", () => {
    const out = จับคู่ตามหัวตาราง([["ผู้ติดต่อ", "บริษัท", "โทรศัพท์"], ["คุณเอ", "บจ. ก", "081"]], ชื่อคอลัมน์);
    expect(out[0]).toEqual({ company: "บจ. ก", name: "คุณเอ", phone: "081" });
  });

  it("หัวตารางภาษาอังกฤษก็จับคู่ได้ · คอลัมน์ที่ไม่มีให้เป็นค่าว่าง", () => {
    const out = จับคู่ตามหัวตาราง([["Company", "Contact"], ["บจ. ข", "คุณบี"]], ชื่อคอลัมน์);
    expect(out[0]).toEqual({ company: "บจ. ข", name: "คุณบี", phone: "" });
  });

  it("ไม่มีหัวตารางที่รู้จัก → อ่านตามลำดับ และไม่ทิ้งแถวแรก", () => {
    const out = จับคู่ตามหัวตาราง([["บจ. ค", "คุณซี", "082"]], ชื่อคอลัมน์);
    expect(out).toHaveLength(1);
    expect(out[0].company).toBe("บจ. ค");
  });

  it("นามสกุลที่รับได้ ต้องครอบทั้ง csv และ xlsx", () => {
    expect(นามสกุลที่รับได้).toContain(".csv");
    expect(นามสกุลที่รับได้).toContain(".xlsx");
  });
});
