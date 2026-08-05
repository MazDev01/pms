// หา export ที่ไม่มีไฟล์อื่นอ้างถึงเลย — รันด้วย: node scripts/find-dead-exports.mjs
//
// ทำไมต้องมีสคริปต์นี้ (ผลตรวจสอบระบบ 5 ส.ค. 69):
//   ESLint จับได้แค่ "import มาแล้วไม่ใช้ในไฟล์นั้น" · TypeScript จับได้แค่ "อ้างถึงของที่ไม่มี"
//   ไม่มีตัวไหนจับ "export ไว้แต่ไม่มีใครเอาไปใช้" ซึ่งเป็นโค้ดตายที่สะสมเงียบ ๆ
//   เคยลองใช้ knip แล้วอ่านโครงสร้าง monorepo (@pms/shared/* → packages/shared/*) ไม่ออก
//   รายงานไฟล์ที่ใช้จริงว่าตายเป็นร้อยไฟล์ — เชื่อไม่ได้ จึงเขียนตัวตรวจที่ยืนยันผลได้เองแทน
//
// ⚠️ วิธียืนยันว่าตัวตรวจยังทำงานถูก (ทำทุกครั้งก่อนเชื่อผล — เคยพลาดมาแล้ว):
//   ต้องทดสอบ "สองทาง" ไม่ใช่ทางเดียว
//     1) ใส่ export ปลอมที่ไม่มีใครใช้ → ต้องถูกรายงาน
//     2) เช็คว่า export ที่ใช้จริงแน่ ๆ (เช่น CustomerTable) → ต้องไม่ถูกรายงาน
//   ครั้งหนึ่งเคยเช็คแค่ข้อ 1 แล้วผ่าน ทั้งที่ regex พัง จนรายงานว่า "ทุกอย่างตาย" — ข้อ 2 คือตัวจับ
//
// ข้อจำกัดที่ตั้งใจ: นับด้วยการค้นชื่อในไฟล์อื่น (ไม่ได้วิเคราะห์ AST)
//   ชื่อที่ไปตรงกับคำในคอมเมนต์/ตัวแปรอื่นจะถูกนับว่า "ใช้อยู่" → ผลที่ได้จึงเป็น "อย่างน้อยเท่านี้"
//   เหมาะกับใช้เป็นรายการตั้งต้นให้คนตรวจต่อ ไม่ใช่ลบตามอัตโนมัติ
//   โดยเฉพาะ type ของ props ที่ export ไว้เป็น API ของคอมโพเนนต์ — ปกติไม่ควรลบแม้ไม่มีใคร import
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === ".next" || e === ".turbo") continue;
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
})(".") ;

const src = new Map();
for (const f of files) { try { src.set(f, readFileSync(f, "utf8")); } catch {} }

const FRAMEWORK = new Set([
  "metadata", "generateMetadata", "viewport", "generateViewport", "runtime", "dynamic",
  "revalidate", "fetchCache", "preferredRegion", "maxDuration", "generateStaticParams",
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "middleware", "config",
]);
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const rows = [];
for (const [file, text] of src) {
  
  for (const m of text.matchAll(EXPORT_RE)) {
    const name = m[1];
    // ชื่อที่ "เฟรมเวิร์กเรียกเอง" ไม่ได้ถูก import จากที่ไหน — ไม่ใช่โค้ดตาย
    if (FRAMEWORK.has(name)) continue;
    let used = 0, usedIn = [];
    for (const [f2, t2] of src) {
      if (f2 === file) continue;
      if (new RegExp("\\b" + name + "\\b").test(t2)) { used++; usedIn.push(f2); if (used > 2) break; }
    }
    if (used === 0) rows.push({ file, name });
  }
}
rows.sort((a, b) => a.file.localeCompare(b.file));
console.log(`export ที่ไม่มีไฟล์อื่นอ้างถึงเลย: ${rows.length} รายการ\n`);
let last = "";
for (const r of rows) {
  if (r.file !== last) { console.log(`\n${r.file}`); last = r.file; }
  console.log(`   ${r.name}`);
}
