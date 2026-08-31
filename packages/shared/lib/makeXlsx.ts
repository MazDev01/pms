/** สร้างไฟล์ Excel (.xlsx) จากหัวตาราง + แถวข้อมูล — ไว้ทำ "เทมเพลตให้กรอก"
 *
 *  ทำไมไม่ส่งเป็น CSV: ผู้ใช้ดับเบิลคลิกไฟล์ CSV แล้วเครื่องมักเปิดด้วยโปรแกรมแก้ข้อความ
 *  เจอเป็นบรรทัดคั่นลูกน้ำ กรอกต่อไม่ได้ (บอสแจ้ง 28 ส.ค. 69) — .xlsx เปิดแล้วเป็นตารางพร้อมพิมพ์ทันที
 *
 *  ⚠️ ไม่พึ่งไลบรารีภายนอกด้วยเหตุผลเดียวกับ importSheet.ts
 *  เก็บไฟล์ในซองแบบไม่บีบอัด (stored) — Excel เปิดได้ปกติ และไม่ต้องมีตัวบีบอัดในเบราว์เซอร์
 */

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export function หนีอักขระXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** A, B, … Z, AA */
export function อักษรคอลัมน์(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0;) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** เขียนทุกช่องเป็นข้อความ (inlineStr) — เบอร์โทร "081-…" และเลขผู้เสียภาษีต้องไม่ถูก Excel แปลงเป็นตัวเลข/วันที่ */
function แผ่นงาน(หัว: string[], แถว: string[][], กว้าง: number[]): string {
  const cols = `<cols>${กว้าง.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const ทำแถว = (ช่อง: string[], เลขแถว: number) =>
    `<row r="${เลขแถว}">${ช่อง.map((v, i) =>
      `<c r="${อักษรคอลัมน์(i)}${เลขแถว}" t="inlineStr"><is><t xml:space="preserve">${หนีอักขระXml(v)}</t></is></c>`).join("")}</row>`;
  const เนื้อ = [หัว, ...แถว].map((r, i) => ทำแถว(r, i + 1)).join("");
  return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${เนื้อ}</sheetData></worksheet>`;
}

export function สร้างไฟล์Xlsx(หัว: string[], แถว: string[][], ชื่อแผ่น = "Sheet1"): Blob {
  const กว้าง = หัว.map((h, i) =>
    Math.min(46, Math.max(14, ...[h, ...แถว.map(r => r[i] ?? "")].map(v => ความกว้าง(v)))));
  const ไฟล์: Record<string, string> = {
    "[Content_Types].xml": `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${หนีอักขระXml(ชื่อแผ่น).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": แผ่นงาน(หัว, แถว, กว้าง),
  };
  return new Blob([ห่อZip(ไฟล์) as unknown as BlobPart],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** ตัวอักษรไทยกินที่กว้างกว่าอักษรละตินราวเท่าตัวเมื่อวัดเป็นหน่วยความกว้างของ Excel */
function ความกว้าง(v: string): number {
  let n = 0;
  for (const ch of v) n += ch.charCodeAt(0) > 0x0e00 ? 1.6 : 1.1;
  return Math.ceil(n) + 2;
}

/* ── ซอง zip แบบไม่บีบอัด ───────────────────────────────────────────── */

function ห่อZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const ก้อน: Uint8Array[] = []; const สารบัญ: Uint8Array[] = [];
  let ตำแหน่ง = 0;
  for (const [ชื่อ, เนื้อ] of Object.entries(files)) {
    const ข้อมูล = enc.encode(เนื้อ);
    const ชื่อไบต์ = enc.encode(ชื่อ);
    const crc = crc32(ข้อมูล);

    const หัวไฟล์ = new Uint8Array(30);
    const h = new DataView(หัวไฟล์.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true);
    h.setUint32(14, crc, true); h.setUint32(18, ข้อมูล.length, true); h.setUint32(22, ข้อมูล.length, true);
    h.setUint16(26, ชื่อไบต์.length, true);
    ก้อน.push(หัวไฟล์, ชื่อไบต์, ข้อมูล);

    const cd = new Uint8Array(46);
    const d = new DataView(cd.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true);
    d.setUint32(16, crc, true); d.setUint32(20, ข้อมูล.length, true); d.setUint32(24, ข้อมูล.length, true);
    d.setUint16(28, ชื่อไบต์.length, true); d.setUint32(42, ตำแหน่ง, true);
    สารบัญ.push(cd, ชื่อไบต์);

    ตำแหน่ง += 30 + ชื่อไบต์.length + ข้อมูล.length;
  }
  const สารบัญรวม = ต่อไบต์(สารบัญ);
  const ท้าย = new Uint8Array(22);
  const e = new DataView(ท้าย.buffer);
  const จำนวน = Object.keys(files).length;
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, จำนวน, true); e.setUint16(10, จำนวน, true);
  e.setUint32(12, สารบัญรวม.length, true); e.setUint32(16, ตำแหน่ง, true);
  return ต่อไบต์([...ก้อน, สารบัญรวม, ท้าย]);
}

function ต่อไบต์(ชิ้น: Uint8Array[]): Uint8Array {
  const รวม = new Uint8Array(ชิ้น.reduce((n, b) => n + b.length, 0));
  let i = 0;
  for (const b of ชิ้น) { รวม.set(b, i); i += b.length; }
  return รวม;
}

// ตารางตรวจความถูกต้องของไฟล์ในซอง zip — ถ้าเลขนี้ผิด Excel จะฟ้องว่าไฟล์เสียหายและไม่ยอมเปิด
const ตารางCrc = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(ข้อมูล: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < ข้อมูล.length; i++) c = ตารางCrc[(c ^ ข้อมูล[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
