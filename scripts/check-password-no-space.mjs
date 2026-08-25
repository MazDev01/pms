// ── ช่องรหัสผ่าน/อีเมลเข้าระบบ ต้องตัดช่องว่างทิ้งตั้งแต่ตอนพิมพ์ (บอสสั่ง 25 ส.ค. 69) ──
//
// หน้าเข้าสู่ระบบตัดช่องว่างทิ้งแล้ว ถ้าที่อื่น "ตั้งรหัสที่มีเว้นวรรค" ให้ใครไว้ได้
// เจ้าของบัญชีจะพิมพ์รหัสของตัวเองไม่ได้เลย = ล็อกคนออกจากระบบโดยไม่มีใครรู้ว่าเพราะอะไร
// (ต้นเรื่อง: ผู้ใช้แจ้งว่ามีช่องว่างนำหน้าอีเมลแล้วเข้าไม่ได้)
import { readFileSync, globSync } from "node:fs";

const ช่องที่ต้องกัน = /(tempPassword|newPassword|\bpassword\b|setPassword)/;
const กันแล้ว = String.raw`replace(/\s/g`;   // ข้อความตรง ๆ ไม่ใช่ regex — กันสับสนเรื่อง backslash
let พบ = 0;

for (const f of globSync("{apps,packages}/**/*.tsx", { exclude: p => p.includes("node_modules") || p.includes(".next") })) {
  readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (!/onChange=/.test(line)) return;
    if (!ช่องที่ต้องกัน.test(line)) return;
    if (line.includes(กันแล้ว)) return;
    พบ++;
    console.log(`  ${f}:${i + 1} — ช่องรหัสผ่านยังรับช่องว่างอยู่`);
  });
}
console.log(`ช่องรหัสผ่านที่ยังไม่ได้กันช่องว่าง: ${พบ}`);
if (พบ > 0) process.exit(1);
