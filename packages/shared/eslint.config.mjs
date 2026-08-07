// ── ESLint ของ packages/shared ─────────────────────────────────────────────────
//
// ทำไมเพิ่งมี: แพ็กเกจนี้คือ "ตัวจริง" ของระบบ (คอมโพเนนต์/บริบท/ชั้นข้อมูล เกือบทั้งหมดอยู่ที่นี่)
//   แต่ไม่เคยถูก ESLint ตรวจเลยสักครั้ง — คำสั่ง lint ของแต่ละแอปคือ `next lint` ซึ่งตรวจเฉพาะ
//   โฟลเดอร์ของแอปตัวเอง ไฟล์นอกไดเรกทอรีถูกข้ามทั้งหมด
//   ผลตรวจสอบระบบรอบ 2 ชี้ว่านี่คือ "รากของปัญหา" ที่ทำให้การแก้รอบก่อน ๆ ไม่ครบ:
//   ของที่ ESLint จับได้ตามปกติ (ตัวแปรที่ประกาศแล้วไม่ใช้ · dependency ของ hook ไม่ครบ ·
//   การ import ที่ตายแล้ว) ไม่มีอะไรมาคอยจับให้เลยตลอดทั้งโปรเจกต์
//
// ใช้ชุดกฎเดียวกับแอป (next/core-web-vitals + next/typescript) เพื่อไม่ให้มาตรฐานสองมาตรฐาน
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["node_modules/**", "dist/**"] },
  {
    rules: {
      // ขึ้นต้นด้วย _ = "ประกาศไว้แต่ตั้งใจไม่ใช้" ซึ่งเลี่ยงไม่ได้จริง ๆ ในสองกรณี:
      //   • ตัดฟิลด์ทิ้งตอน destructure — const { id: _drop, ...rest } = q
      //   • พารามิเตอร์ที่ต้องมีเพื่อให้ตำแหน่งถูก แต่ตัวมันเองไม่ได้ใช้
      // ถ้าไม่ยกเว้นให้ จะเหลือทางเดียวคือใส่ eslint-disable ทีละจุด ซึ่งปิดคำเตือน "ทุกอย่าง" ในบรรทัดนั้น
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_",
      }],
      // รูปทั้งหมดในระบบคือรูปโปรไฟล์/โลโก้ที่ผู้ใช้อัปโหลดเอง เก็บเป็น data URI ในฐานข้อมูล
      // <Image /> ของ Next ใช้กับรูปแบบนี้ไม่ได้ (ต้องรู้ที่มา/ขนาดล่วงหน้า) — กฎนี้จึงไม่ตรงกับงานจริงที่นี่
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
