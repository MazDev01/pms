// ── ตรวจว่าเทสต์ "หาแถวในตารางที่แบ่งหน้า" โดยไม่ค้นหาก่อนหรือเปล่า ────────────────
//
// ทำไมต้องมี (บทเรียนจริง 6–7 ส.ค. 69 · เจอซ้ำ 3 รอบ):
//   หน้าลูกค้า/ลีดแบ่งหน้า และตอนรันชุดเต็ม สเปกอื่นเพิ่มข้อมูลของสาขาเดียวกันแทรกเข้ามาตลอด
//   แถวที่เทสต์เพิ่งสร้างจึงถูกดันตกหน้าแรก → เทสต์ตกด้วย "ไม่เจอข้อมูล" ทั้งที่ข้อมูลอยู่ครบ
//   ชี้ไปผิดทางสนิท เพราะดูเหมือนแอปไม่ได้บันทึก ทั้งที่บันทึกเรียบร้อยแล้ว
//
//   6 ส.ค. แก้ไป 6 จุด · 7 ส.ค. เจออีก 1 จุด แก้แล้วเจออีก 2 จุด (ตกหล่นในไฟล์เดียวกันแท้ ๆ)
//   = ไล่ดูเอาเองไม่มีทางครบ ต้องให้เครื่องมือหาแทน
//
//   หมายเหตุ: หน้าจอจริงตั้งช่องค้นหาให้อัตโนมัติด้วยเหตุผลเดียวกันเป๊ะ
//   (customers/page.tsx "ตั้งช่องค้นหาให้ทันที กันลูกค้าที่เพิ่งปิดการขายหายไปในรายการที่แบ่งหน้า")
//   แปลว่าทีมรู้เรื่องนี้อยู่แล้ว แค่ฝั่งเทสต์ไม่ได้ทำตาม
//
// กติกา: ถ้าเทสต์ไปที่หน้าที่แบ่งหน้า (/customers, /leads, /hq/customers, /hq/leads)
//   แล้วตามด้วยการ "หาแถว/หาข้อความเฉพาะ" ต้องมีการกรอกช่องค้นหาคั่นก่อน
//
// ── รอบสอง (10 ส.ค. 69): ต้องดูด้วยว่า "ค้นหาให้แท็บไหน" ──────────────────────────
//   เทสต์เปิดสองแท็บพร้อมกัน (pageA/pageB) ใส่คำสั่งค้นหาให้ pageA แท็บเดียว
//   แต่ไปหาแถวจาก pageB ด้วย → pageB เห็นตารางที่ไม่ได้กรอง แถวเป้าหมายตกไปหน้าถัดไป
//   ตัวตรวจรอบแรกปล่อยผ่าน เพราะเห็นว่า "มีคำสั่งค้นหาอยู่จริง" แล้วถือว่าปลอดภัยทันที
//   ผลคือเทสต์นี้ตกบ้างไม่ตกบ้างอยู่หลายวัน ขึ้นกับว่าสเปกอื่นสร้างข้อมูลค้างไว้เท่าไหร่
//   → ตอนนี้จำเป็นรายแท็บ: ค้นหาให้ pageA ไม่ได้แปลว่า pageB ปลอดภัยด้วย
//
// รัน: node scripts/check-paginated-lookup.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = "tests/scenario";
// หน้าที่แบ่งหน้าจริง — ยืนยันจากโค้ดหน้าจอว่ามีตัวแบ่งหน้า/จำกัดจำนวนต่อหน้า
const PAGED = /\$\{(DEALER_ORIGIN|HQ_ORIGIN)\}\/(hq\/)?(customers|leads)\b/;
// การ "หาแถวเฉพาะ" — ต่างจากการเช็กว่าหน้าโหลดขึ้น (เช่น .length > 100) ซึ่งไม่ใช่กับดัก
const LOOKUP = /toContain\((COMPANY|company|TITLE|tg\(|NEW_|LONG)|locator\("tbody tr"\)\.filter\(/;
const SEARCH = /getByPlaceholder\("ค้นหา/;
// จับว่าคำสั่งนั้นทำกับแท็บไหน — ชื่อตัวแปรที่อยู่หน้าจุด เช่น pageB.getByPlaceholder(...)
const SEARCH_ON = /\b(page[A-Za-z0-9_]*)\.getByPlaceholder\("ค้นหา/;
const LOOKUP_ON = /\b(page[A-Za-z0-9_]*)\.locator\("tbody tr"\)\.filter\(/;

const bad = [];
for (const name of readdirSync(DIR)) {
  if (!name.endsWith(".spec.ts")) continue;
  const file = path.join(DIR, name);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    if (!PAGED.test(lines[i]) || !/goto\(/.test(lines[i])) continue;
    // มองไปข้างหน้า 12 บรรทัด — เก็บว่า "ค้นหาให้แท็บไหนไปแล้วบ้าง" ระหว่างทาง
    const searched = new Set();     // ชื่อแท็บที่ค้นหาแล้ว · "" = ค้นหาแบบไม่ระบุชื่อแท็บ (เทสต์แท็บเดียว)
    for (let j = i + 1; j < Math.min(i + 13, lines.length); j++) {
      if (/await page\.goto\(/.test(lines[j])) break;    // ออกจากหน้านี้ไปแล้ว
      if (SEARCH.test(lines[j])) {
        searched.add(SEARCH_ON.exec(lines[j])?.[1] ?? "");
        continue;                                        // ⚠️ ห้าม break — แท็บอื่นอาจยังไม่ได้ค้นหา
      }
      if (!LOOKUP.test(lines[j])) continue;

      const on = LOOKUP_ON.exec(lines[j])?.[1] ?? "";
      // ปลอดภัยเมื่อ: ค้นหาให้แท็บนี้แล้ว · หรือระบุแท็บไม่ได้แต่มีการค้นหาเกิดขึ้นแล้ว (เทสต์แท็บเดียว)
      const safe = on ? (searched.has(on) || searched.has("")) : searched.size > 0;
      if (safe) continue;
      bad.push({
        file: file.replace(/\\/g, "/"), line: j + 1,
        page: lines[i].trim().slice(0, 70), code: lines[j].trim().slice(0, 80),
        why: searched.size ? `ค้นหาให้ ${[...searched].join("/")} แล้ว แต่ ${on} ยังไม่ได้ค้นหา` : "ไม่ได้ค้นหาก่อนเลย",
      });
    }
  }
}

for (const b of bad) console.log(`${b.file}:${b.line}\n    ไปที่: ${b.page}\n    แล้วหา: ${b.code}\n    สาเหตุ: ${b.why}`);
console.log(`\nจุดที่หาแถวในตารางแบ่งหน้าโดยไม่ค้นหาก่อน: ${bad.length}`);
process.exit(bad.length ? 1 : 0);
