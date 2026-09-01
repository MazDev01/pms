// ── ด่านก่อนขึ้นเว็บจริง — ตัดสินว่า "คอมมิตนี้ควร build ขึ้นเว็บจริงไหม" ──────────────
//
// ทำไมต้องมี (1 ก.ย. 69): พอเชื่อม GitHub เข้ากับ Vercel แล้ว **ทุก push ขึ้นเว็บจริงทันที**
//   รวมถึงงานที่ยังทำค้างอยู่ของอีกหน้าต่างด้วย (ตอนตั้งด่านนี้ งานรื้อฟอร์มใบเสนอราคา/VAT
//   ยังไม่จบและเทสต์ตกอยู่ 7 ข้อ) — ความเร็วที่ได้มาแลกกับความเสี่ยงที่ลูกค้าเห็นของครึ่ง ๆ กลาง ๆ
//
// Vercel เรียกไฟล์นี้ก่อน build (ตั้งไว้ที่ apps/*/vercel.json → ignoreCommand)
//   ⚠️ ความหมายของรหัสจบงาน "กลับด้าน" กับปกติ:
//        exit 0 = ข้าม ไม่ต้อง build     exit 1 = build ต่อได้
//
// ด่านนี้ตั้งใจให้ "ทำงานได้แม้ยังไม่ได้ติดตั้ง dependency" เพราะ Vercel อาจเรียกก่อน install
//   บนเซิร์ฟเวอร์จึงตรวจแค่สองอย่างที่ตรวจได้จริง: ป้ายกำกับในข้อความคอมมิต และไฟล์ที่เปลี่ยน
//   ส่วนคุณภาพโค้ด (typecheck/เทสต์/ชุดกันพลาด) มี GitHub Actions ตรวจทุก push อยู่แล้ว
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ราก = path.resolve(import.meta.dirname, "..");
const ข้อความคอมมิต = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "";
const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "(ไม่ทราบ)";

const ข้าม = (เหตุผล) => { console.log(`⛔ ไม่ขึ้นเว็บจริง — ${เหตุผล}`); process.exit(0); };
const ไปต่อ = (เหตุผล) => { console.log(`✅ ขึ้นเว็บจริงได้ — ${เหตุผล}`); process.exit(1); };

console.log(`ตรวจก่อนขึ้นเว็บจริง · branch=${branch} · คอมมิต: ${ข้อความคอมมิต.split("\n")[0].slice(0, 80)}`);

// 1) ทางลัดสำหรับคนเขียนโค้ด — เขียน [skip deploy] หรือ [wip] ในข้อความคอมมิต = ไม่ต้องขึ้นเว็บจริง
//    ใช้ตอนอยากเก็บงานไว้บน GitHub ก่อน (สำรอง/ให้อีกเครื่องดึงไปทำต่อ) แต่ยังไม่พร้อมให้คนใช้เห็น
if (/\[(skip deploy|wip|ยังไม่เสร็จ)\]/i.test(ข้อความคอมมิต)) {
  ข้าม("คอมมิตนี้ระบุว่ายังไม่พร้อมขึ้นเว็บจริง ([skip deploy] / [wip])");
}

// 2) เปลี่ยนแค่เอกสาร/ชุดทดสอบ = ไม่มีอะไรบนเว็บเปลี่ยน ไม่ต้อง build ให้เปลืองเวลา
try {
  const ไฟล์ที่เปลี่ยน = execSync("git diff --name-only HEAD^ HEAD", { cwd: ราก, encoding: "utf8" })
    .split(/?
/).map(x => x.trim()).filter(Boolean);
  if (ไฟล์ที่เปลี่ยน.length && ไฟล์ที่เปลี่ยน.every(f => /^(docs\/|tests\/|README|\.github\/)/.test(f))) {
    ข้าม(`คอมมิตนี้แตะแต่เอกสาร/ชุดทดสอบ (${ไฟล์ที่เปลี่ยน.length} ไฟล์) เว็บจริงไม่มีอะไรเปลี่ยน`);
  }
} catch { /* ดูประวัติไม่ได้ (clone ตื้น) — ไม่ถือว่าไม่ผ่าน */ }

// 3) ชุดกันพลาดของเราเอง — รันได้เฉพาะบนเครื่องที่มีโปรเจกต์ครบ
//    ⚠️ บนเซิร์ฟเวอร์ Vercel ไฟล์ tests/ กับ docs/ ถูกกันไม่ให้อัพขึ้นไป (ดู .vercelignore)
//       ตัวตรวจบางตัวอ่านโฟลเดอร์พวกนั้น ถ้าฝืนรันจะล้มเพราะ "ไม่มีไฟล์" แล้วบล็อกทุก deploy
//       (เจอจริง 1 ก.ย. 69 — ทุก push ถูกข้ามหมดโดยไม่มีอะไรผิดจริง)
//    คุณภาพของโค้ดถูกตรวจครบอยู่แล้วที่ GitHub Actions (.github/workflows/ci.yml):
//       typecheck + เทสต์ย่อย + ชุดกันพลาด ทุก push
//    และถ้าโค้ดคอมไพล์ไม่ผ่าน Vercel เองจะ build ไม่สำเร็จ ของเก่าบนเว็บจริงยังอยู่เหมือนเดิม
if (existsSync(path.join(ราก, "tests", "scenario"))) {
  try {
    execSync("npm run checks", { cwd: ราก, stdio: "inherit" });
  } catch {
    ข้าม("ชุดกันพลาด (npm run checks) ไม่ผ่าน — แก้ให้ผ่านก่อนแล้ว push ใหม่");
  }
  if (existsSync(path.join(ราก, "node_modules", "typescript"))) {
    try {
      execSync("npm run typecheck", { cwd: ราก, stdio: "inherit" });
    } catch {
      ข้าม("typecheck ไม่ผ่าน — โค้ดยังมีที่ผิดชนิดข้อมูล");
    }
  }
} else {
  console.log("(ไม่มีโฟลเดอร์ tests/ ที่นี่ = กำลังรันบนเซิร์ฟเวอร์ build — ข้ามชุดกันพลาด ให้ GitHub Actions ตรวจแทน)");
}

ไปต่อ("ผ่านด่านตรวจครบ");
