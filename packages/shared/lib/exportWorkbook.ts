/** เขียนไฟล์ Excel ของจริง (.xlsx) จากในเบราว์เซอร์ — หลายแผ่นงานในไฟล์เดียว
 *
 *  ทำไมต้องมี: ของเดิมส่งออก "Excel" เป็นตาราง HTML ที่ตั้งชื่อว่า .xls
 *  Excel เปิดได้ก็จริงแต่ขึ้นคำเตือน "รูปแบบไฟล์ไม่ตรงกับนามสกุล" ทุกครั้ง
 *  และ Google Sheets / Numbers / มือถือ เปิดไม่ขึ้นเลย — ไม่ใช่ไฟล์ที่คนทั่วไปใช้กันจริง
 *
 *  ⚠️ ตั้งใจไม่พึ่งไลบรารีภายนอก (เหตุผลเดียวกับ importSheet.ts — แพ็กเกจ xlsx บน npm
 *     ค้างอยู่ที่รุ่นที่มีช่องโหว่) · zip เขียนแบบ "เก็บดิบ" (method 0) จึงไม่ต้องมีตัวบีบอัด
 *     ไฟล์ใหญ่กว่าปกติเล็กน้อย แต่เป็น .xlsx ที่ถูกต้องตามมาตรฐาน เปิดได้ทุกโปรแกรม
 */

export type ช่อง = string | number;
export type แผ่นงานที่จะเขียน = {
  ชื่อ: string;
  หัวตาราง: string[];
  แถว: ช่อง[][];
  /** ความกว้างคอลัมน์ (หน่วยของ Excel) — ไม่ส่งมา = กว้างเท่ากันหมด */
  กว้างคอลัมน์?: number[];
};

/* ── XML ────────────────────────────────────────────────────────────── */
export function หนีXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    // อักขระควบคุมทำให้ Excel ฟ้องว่าไฟล์เสียหาย — ตัดทิ้งก่อน (เว้น tab/ขึ้นบรรทัด)
    .split("").filter(ch => { const n = ch.charCodeAt(0); return n > 31 || n === 9 || n === 10 || n === 13; }).join("");
}

/** 0→A, 25→Z, 26→AA */
export function ชื่อคอลัมน์(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** ชื่อแผ่นงานของ Excel: ยาวไม่เกิน 31 ตัว และห้ามมี : \ / ? * [ ] */
export function ชื่อแผ่นที่ใช้ได้(ชื่อ: string): string {
  const สะอาด = (ชื่อ || "แผ่น1").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  return สะอาด || "แผ่น1";
}

function แผ่นเป็นXml(หัวตาราง: string[], แถว: ช่อง[][], กว้างคอลัมน์?: number[]): string {
  const ทั้งหมด = หัวตาราง.length ? [หัวตาราง, ...แถว] : แถว;
  const บรรทัด = ทั้งหมด.map((r, ri) => {
    const ช่องทั้งแถว = r.map((c, ci) => {
      const ที่ = `${ชื่อคอลัมน์(ci)}${ri + 1}`;
      // ตัวเลขต้องเขียนเป็นตัวเลขจริง ไม่งั้น Excel บวกลบไม่ได้ (ขึ้นสามเหลี่ยมเขียว "เก็บเป็นข้อความ")
      if (typeof c === "number" && Number.isFinite(c)) return `<c r="${ที่}"><v>${c}</v></c>`;
      const ข้อความ = String(c ?? "");
      if (!ข้อความ) return "";
      // หัวตารางทำตัวหนา (style 1) — อ่านง่ายเวลาเปิดจริง
      const สไตล์ = ri === 0 && หัวตาราง.length ? ` s="1"` : "";
      return `<c r="${ที่}"${สไตล์} t="inlineStr"><is><t xml:space="preserve">${หนีXml(ข้อความ)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${ช่องทั้งแถว}</row>`;
  }).join("");
  const กว้าง = (กว้างคอลัมน์ ?? (หัวตาราง.length ? หัวตาราง : (แถว[0] ?? [])).map(() => 22))
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + (กว้าง ? `<cols>${กว้าง}</cols>` : "")
    + `<sheetData>${บรรทัด}</sheetData></worksheet>`;
}

/* ── zip (เก็บดิบ ไม่บีบอัด) ─────────────────────────────────────────── */
const ตารางCRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = ตารางCRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function สร้างZip(ไฟล์: { ชื่อ: string; เนื้อ: string }[]): Blob {
  const enc = new TextEncoder();
  const ก้อน: Uint8Array[] = [];
  const สารบัญ: Uint8Array[] = [];
  let ตำแหน่ง = 0;
  for (const f of ไฟล์) {
    const ชื่อ = enc.encode(f.ชื่อ);
    const ข้อมูล = enc.encode(f.เนื้อ);
    const crc = crc32(ข้อมูล);
    const หัว = new Uint8Array(30 + ชื่อ.length);
    const hv = new DataView(หัว.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);            // ต้องการรุ่น 2.0
    hv.setUint16(6, 0x0800, true);        // ธงบอกว่าชื่อไฟล์เป็น UTF-8
    hv.setUint16(8, 0, true);             // วิธีบีบ 0 = เก็บดิบ
    hv.setUint32(14, crc, true);
    hv.setUint32(18, ข้อมูล.length, true);
    hv.setUint32(22, ข้อมูล.length, true);
    hv.setUint16(26, ชื่อ.length, true);
    หัว.set(ชื่อ, 30);
    ก้อน.push(หัว, ข้อมูล);

    const c = new Uint8Array(46 + ชื่อ.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, ข้อมูล.length, true);
    cv.setUint32(24, ข้อมูล.length, true);
    cv.setUint16(28, ชื่อ.length, true);
    cv.setUint32(42, ตำแหน่ง, true);
    c.set(ชื่อ, 46);
    สารบัญ.push(c);
    ตำแหน่ง += หัว.length + ข้อมูล.length;
  }
  const ยาวสารบัญ = สารบัญ.reduce((s, b) => s + b.length, 0);
  const ท้าย = new Uint8Array(22);
  const tv = new DataView(ท้าย.buffer);
  tv.setUint32(0, 0x06054b50, true);
  tv.setUint16(8, ไฟล์.length, true);
  tv.setUint16(10, ไฟล์.length, true);
  tv.setUint32(12, ยาวสารบัญ, true);
  tv.setUint32(16, ตำแหน่ง, true);
  return new Blob([...ก้อน, ...สารบัญ, ท้าย] as BlobPart[],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ── ทางเข้าหลัก ───────────────────────────────────────────────────── */
export function สร้างไฟล์Xlsx(แผ่นงาน: แผ่นงานที่จะเขียน[]): Blob {
  // กันชื่อแผ่นซ้ำ — Excel ไม่ยอมให้มีชื่อซ้ำในสมุดเดียวกัน (เปิดไฟล์ไม่ขึ้นเลย)
  const ใช้แล้ว = new Set<string>();
  const แผ่น = (แผ่นงาน.length ? แผ่นงาน : [{ ชื่อ: "ข้อมูล", หัวตาราง: [], แถว: [] }]).map(s => {
    let ชื่อ = ชื่อแผ่นที่ใช้ได้(s.ชื่อ);
    for (let i = 2; ใช้แล้ว.has(ชื่อ); i++) ชื่อ = ชื่อแผ่นที่ใช้ได้(`${s.ชื่อ} ${i}`);
    ใช้แล้ว.add(ชื่อ);
    return { ...s, ชื่อ };
  });

  const ไฟล์ = [
    { ชื่อ: "[Content_Types].xml", เนื้อ: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + แผ่น.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
      + `</Types>` },
    { ชื่อ: "_rels/.rels", เนื้อ: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
      + `</Relationships>` },
    { ชื่อ: "xl/workbook.xml", เนื้อ: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
      + แผ่น.map((s, i) => `<sheet name="${หนีXml(s.ชื่อ)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")
      + `</sheets></workbook>` },
    { ชื่อ: "xl/_rels/workbook.xml.rels", เนื้อ: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + แผ่น.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
      + `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + `</Relationships>` },
    // สไตล์ขั้นต่ำ: 0 = ปกติ · 1 = ตัวหนา (ใช้กับแถวหัวตาราง)
    { ชื่อ: "xl/styles.xml", เนื้อ: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + `<fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts>`
      + `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>`
      + `<borders count="1"><border/></borders>`
      + `<cellStyleXfs count="1"><xf/></cellStyleXfs>`
      + `<cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs>`
      + `</styleSheet>` },
    ...แผ่น.map((s, i) => ({ ชื่อ: `xl/worksheets/sheet${i + 1}.xml`, เนื้อ: แผ่นเป็นXml(s.หัวตาราง, s.แถว, s.กว้างคอลัมน์) })),
  ];
  return สร้างZip(ไฟล์);
}

/** ช่องที่หน้าจอจัดรูปแบบมาแล้ว ("฿2,160,000", "1,250.50") → ตัวเลขจริงสำหรับ Excel
 *
 *  หน้าจอส่งข้อความที่จัดรูปแบบไว้แล้วมาให้ปุ่มส่งออก (เพราะ PDF ต้องอ่านสวยเหมือนบนจอ)
 *  แต่ถ้าเขียนลง Excel เป็นข้อความ ผู้ใช้จะรวมยอด/เรียงลำดับ/ทำกราฟไม่ได้เลย — ต้องแปลงกลับ
 *
 *  ⚠️ แปลงเฉพาะที่เป็น "ตัวเลขล้วน" เท่านั้น · ค่าอย่าง "45%" · "—" · "12 วัน" · รหัสที่ขึ้นต้นด้วย 0
 *     คงเป็นข้อความไว้ตามเดิม (แปลงแล้วความหมายเพี้ยน หรือเลข 0 นำหน้าหาย) */
export function ค่าสำหรับExcel(c: ช่อง): ช่อง {
  if (typeof c === "number") return c;
  const t = String(c ?? "").trim();
  if (!t || !/^฿?\s*-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t)) return c;
  const ดิบ = t.replace(/[฿,\s]/g, "");
  if (/^-?0\d/.test(ดิบ)) return c;                 // 081-… หรือเลขที่ต้องคงศูนย์นำหน้า
  const n = Number(ดิบ);
  return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : c;
}

/** ดาวน์โหลดไฟล์ที่สร้างไว้ — ใช้ร่วมกันทุกที่ที่มีปุ่มส่งออก */
export function ดาวน์โหลดไฟล์(blob: Blob, ชื่อไฟล์: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ชื่อไฟล์;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
