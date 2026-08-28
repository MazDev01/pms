// รันชุดทดสอบเต็มบน "โค้ดแบบที่ขึ้นเว็บจริง" (next build + next start) ไม่ใช่โหมดพัฒนา
//
// ขั้นตอน: build ทั้งสองแอป -> สตาร์ททั้งสองแอปแบบ production -> รอจนพร้อม
//          -> รันชุดทดสอบ -> ปิดเซิร์ฟเวอร์ให้เรียบร้อยเสมอ (แม้เทสต์ล้ม)
//
// ใช้: npm run test:prodbuild
//      npm run test:prodbuild -- tests/scenario/ui.spec.ts     (เจาะไฟล์เดียว)
//      SKIP_BUILD=1 npm run test:prodbuild                      (ใช้ของที่ build ไว้แล้ว)
import { spawn, spawnSync } from "node:child_process";

const MODE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "api";   // ค่าตั้งต้น = โหมดเดียวกับเว็บจริง
const env = { ...process.env, NEXT_PUBLIC_DATA_SOURCE: MODE };
const แอป = [
  { ชื่อ: "hq", cwd: "apps/hq", port: 3002 },
  { ชื่อ: "dealer", cwd: "apps/dealer", port: 3001 },
];

const รอจนพร้อม = async (port, วินาที = 120) => {
  const หมดเวลา = Date.now() + วินาที * 1000;
  while (Date.now() < หมดเวลา) {
    try {
      const r = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return true;
    } catch { /* ยังไม่ขึ้น */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
};

const เซิร์ฟเวอร์ = [];
const ปิดทั้งหมด = () => {
  for (const p of เซิร์ฟเวอร์) { try { p.kill(); } catch { /* ปิดไปแล้ว */ } }
};
process.on("exit", ปิดทั้งหมด);
process.on("SIGINT", () => { ปิดทั้งหมด(); process.exit(130); });

if (!process.env.SKIP_BUILD) {
  console.log(`▶ build ทั้งสองแอป (โหมด ${MODE}) — ใช้เวลาราว 1 นาที`);
  const b = spawnSync("npm", ["run", "build"], { env, stdio: "inherit", shell: true });
  if (b.status !== 0) { console.error("build ไม่ผ่าน — หยุด"); process.exit(b.status ?? 1); }
}

for (const a of แอป) {
  console.log(`▶ สตาร์ท ${a.ชื่อ} แบบ production ที่พอร์ต ${a.port}`);
  เซิร์ฟเวอร์.push(spawn("npx", ["next", "start", "-p", String(a.port)], { cwd: a.cwd, env, stdio: "ignore", shell: true }));
}
for (const a of แอป) {
  if (!await รอจนพร้อม(a.port)) { console.error(`${a.ชื่อ} ไม่ขึ้นภายในเวลาที่รอ — หยุด`); ปิดทั้งหมด(); process.exit(1); }
}
console.log("▶ เซิร์ฟเวอร์พร้อม เริ่มรันชุดทดสอบบนโค้ดแบบที่ขึ้นเว็บจริง");

const t = spawn("npx", ["playwright", "test", "-c", "playwright.prodbuild.config.ts", ...process.argv.slice(2)],
  { env, stdio: "inherit", shell: true });
t.on("exit", code => { ปิดทั้งหมด(); process.exit(code ?? 1); });
