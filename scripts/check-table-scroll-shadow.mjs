// ── ตรวจว่าเงาบอกทิศของตาราง "ถูกกลบมิด" ตอนไม่มีอะไรให้เลื่อน ────────────────────
//
// ปัญหาที่กัน (ผู้ใช้แจ้ง 10 ส.ค. 69 · "เงาดำมาจากไหนในตาราง"):
//   .table-wrap ใช้เทคนิค dual-background 4 ชั้น — 2 ชั้นแรกเป็น "ผ้าคลุม" สีพื้นการ์ด
//   (background-attachment: local → เลื่อนไปพร้อมเนื้อหา) ทับ 2 ชั้นหลังที่เป็น "เงา"
//   (attachment: scroll → ติดอยู่กับขอบกรอบ) ผลคือเงาโผล่เฉพาะด้านที่ยังเลื่อนต่อได้
//
//   แต่ถ้าผ้าคลุมแคบกว่าเงา เงาจะโผล่พ้นชายผ้าออกมาตลอดเวลา แม้ตารางจะไม่ล้นเลยสักนิด
//   ของเดิม: ผ้าคลุม 24px · เงา 28px → ทุกตารางทั้งระบบมีแถบเทาคาดขอบซ้าย-ขวาถาวร
//
// ทำไมต้องเป็นตัวตรวจโค้ด ไม่ใช่เทสต์เบราว์เซอร์:
//   อาการนี้เป็น "สีที่จางลงทีละพิกเซล" เทสต์ทั่วไปที่เช็ค class/style ไม่มีทางจับได้
//   ส่วนการวัดสีพิกเซลจริงเปราะและช้า — กติกาต้นทางมีข้อเดียวและตรวจตรงๆ ได้ จึงตรวจที่กติกา
//
// กติกา: ความกว้างผ้าคลุม (2 ค่าแรกของ background-size) ต้อง >= ความกว้างเงา (2 ค่าหลัง)
//
// รัน: node scripts/check-table-scroll-shadow.mjs
import { readFileSync } from "node:fs";

const FILE = "packages/shared/globals.css";
const css = readFileSync(FILE, "utf8");

const start = css.indexOf("\n.table-wrap {\n");
if (start < 0) {
  console.log(`${FILE}  หากฎ .table-wrap ไม่เจอ — ถ้าเปลี่ยนชื่อคลาสแล้ว ต้องอัปเดตตัวตรวจนี้ด้วย`);
  process.exit(1);
}
const block = css.slice(start + 1, css.indexOf("\n}", start) + 2);
const line = /background-size:\s*([^;]+);/.exec(block)?.[1];
if (!line) {
  console.log(`${FILE}  .table-wrap ไม่มี background-size — เทคนิคเงาบอกทิศพังแล้ว`);
  process.exit(1);
}

// "40px 100%, 40px 100%, 28px 100%, 28px 100%" → [40, 40, 28, 28]
const widths = line.split(",").map(s => parseFloat(s.trim()));
if (widths.length !== 4 || widths.some(Number.isNaN)) {
  console.log(`${FILE}  background-size ต้องมี 4 ชั้น (ผ้าคลุมซ้าย/ขวา + เงาซ้าย/ขวา) — เจอ: ${line.trim()}`);
  process.exit(1);
}

const [coverL, coverR, shadowL, shadowR] = widths;
const bad = [];
if (coverL < shadowL) bad.push(`ขอบซ้าย: ผ้าคลุม ${coverL}px แคบกว่าเงา ${shadowL}px`);
if (coverR < shadowR) bad.push(`ขอบขวา: ผ้าคลุม ${coverR}px แคบกว่าเงา ${shadowR}px`);

for (const b of bad) console.log(`${FILE}  ${b} → เงาจะโผล่ค้างแม้ตารางไม่ล้น`);
console.log(`\nขอบตารางที่เงาโผล่ค้าง: ${bad.length}`);
process.exit(bad.length ? 1 : 0);
