// ── ตรวจว่าช่องกรอกทุกช่อง "มีชื่อเรียก" ให้โปรแกรมอ่านหน้าจอหรือยัง ────────────────
//
// ปัญหา: ระบบมีช่องกรอกเกือบ 200 ช่อง แต่แทบไม่มีช่องไหนบอกได้ว่าตัวเองคืออะไร
//   คนที่ใช้โปรแกรมอ่านหน้าจอจะได้ยินแค่ "ช่องกรอกข้อความ" ซ้ำ ๆ ทั้งฟอร์ม โดยไม่รู้ว่าช่องไหนคืออะไร
//   (ผลตรวจสอบระบบรอบ 2 · ระดับสูง · ~110 จุด)
//
// นับว่า "มีชื่อ" ถ้ามีอย่างน้อยหนึ่งอย่าง:
//   • aria-label            — ชื่อที่เขียนกำกับไว้ตรง ๆ
//   • aria-labelledby       — ชี้ไปที่ข้อความอื่นบนหน้า
//   • placeholder           — ข้อความตัวอย่างในช่อง (อ่อนที่สุด แต่ยังดีกว่าไม่มีอะไรเลย)
//   • title                 — ข้อความ tooltip
//   • id ที่มี <label htmlFor> ชี้มา
//   • ถูกห่ออยู่ใน <label> โดยตรง (ตรวจแบบหยาบ: มี <label ในบรรทัดก่อนหน้าไม่เกิน 3 บรรทัด)
//
// รัน: node scripts/check-form-labels.mjs          (สรุปรายไฟล์)
//      node scripts/check-form-labels.mjs --list   (ไล่ทีละจุด)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["apps", "packages"];
const SKIP = new Set(["node_modules", ".next", "dist", ".turbo"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const NAMED = /\b(aria-label|aria-labelledby|placeholder|title)\s*=/;
// ช่องที่ไม่ต้องมีชื่อ: checkbox/radio ที่อยู่ในป้ายอยู่แล้ว · hidden · file ที่ซ่อนไว้ให้ปุ่มสั่ง
const EXEMPT = /type\s*=\s*["'{]?(hidden|checkbox|radio)/;

const files = ROOTS.flatMap(r => walk(r));
const rows = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const labelFor = new Set([...src.matchAll(/<label[^>]*htmlFor=["'{]([\w$.\-]+)/g)].map(m => m[1]));

  const re = /<(input|select|textarea)\b/g;
  let m;
  while ((m = re.exec(src))) {
    // ดึงทั้ง tag ออกมา (ข้ามบรรทัดได้) โดยหา ">" ตัวแรกที่อยู่นอกวงเล็บปีกกา
    let depth = 0, end = m.index;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) { end = i; break; }
    }
    const tag = src.slice(m.index, end + 1);
    if (EXEMPT.test(tag) || NAMED.test(tag)) continue;
    const idm = /\bid\s*=\s*["'{]([\w$.\-]+)/.exec(tag);
    if (idm && labelFor.has(idm[1])) continue;

    const lineNo = src.slice(0, m.index).split("\n").length;
    // ข้ามที่อยู่ในคอมเมนต์ — เคยรายงานผิดเพราะไปเจอคำว่า <select ในคำอธิบายภาษาไทย
    const own = (lines[lineNo - 1] ?? "").trim();
    if (own.startsWith("//") || own.startsWith("*") || own.startsWith("/*")) continue;
    const near = lines.slice(Math.max(0, lineNo - 4), lineNo).join(" ");
    if (/<label\b/.test(near)) continue;   // ห่ออยู่ใน <label> อยู่แล้ว
    rows.push({ file, line: lineNo, kind: m[1] });
  }
}

const byFile = new Map();
for (const r of rows) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);

if (process.argv.includes("--list")) {
  for (const r of rows) console.log(`${r.file}:${r.line}  <${r.kind}>`);
  console.log("");
}
for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(4), f);
}
console.log(`\nรวมช่องกรอกที่ยังไม่มีชื่อเรียก: ${rows.length} จุด · ${byFile.size} ไฟล์`);
process.exit(rows.length ? 1 : 0);
