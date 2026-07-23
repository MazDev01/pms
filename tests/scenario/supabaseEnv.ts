import { readFileSync } from "node:fs";
import path from "node:path";

// ค่าตั้งต้นของเทสต์ที่ต้องใช้ backend จริง — แยกความลับออกจากโค้ด
//
// ทำไม: รหัสผ่านบัญชีทดสอบเคยเขียนไว้ตรง ๆ ในไฟล์เทสต์ → ติดไปกับ git history ตลอดกาล
// ตอนนี้อ่านจาก tests/.env.test (โดน .gitignore คุมด้วยกฎ .env*) หรือจาก process.env (CI)
// ดูรายการคีย์ที่ต้องตั้งได้ที่ tests/.env.example
//
// ไม่มีไฟล์/ไม่ได้ตั้งค่า = ไม่ใช่ error — ชุดเทสต์ที่ต้องใช้บัญชีจะข้ามตัวเองพร้อมบอกเหตุผล

function readEnvFile(file: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i > 0) out.set(s.slice(0, i).trim(), s.slice(i + 1).trim());
    }
  } catch { /* ไม่มีไฟล์ = ใช้ค่าจาก process.env อย่างเดียว */ }
  return out;
}

const ROOT = path.join(__dirname, "../..");
const appVars  = readEnvFile(path.join(ROOT, "apps/dealer/.env.local"));
const testVars = readEnvFile(path.join(ROOT, "tests/.env.test"));

/** ค่าที่แอปตัวแทนใช้จริง (เป็นตัวกำหนดว่าหน้าเว็บดึงข้อมูลจากไหน) */
export function appEnv(key: string): string {
  return appVars.get(key) ?? "";
}

function testEnv(key: string): string {
  return process.env[key] ?? testVars.get(key) ?? "";
}

export const SUPABASE_URL = appEnv("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON = appEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_MODE = appEnv("NEXT_PUBLIC_DATA_SOURCE") === "supabase";

export type Account = { email: string; password: string };
type Role = "RYG" | "CNX" | "ADMIN";

function account(role: Role): Account {
  return { email: testEnv(`TEST_${role}_EMAIL`), password: testEnv(`TEST_${role}_PASSWORD`) };
}

export const RYG = account("RYG");     // ตัวแทนระยอง
export const CNX = account("CNX");     // ตัวแทนเชียงใหม่ (ใช้ทดสอบการกันข้ามสาขา)
export const ADMIN = account("ADMIN"); // ผู้ดูแลสำนักงานใหญ่

const missing = ([["RYG", RYG], ["CNX", CNX], ["ADMIN", ADMIN]] as const)
  .filter(([, a]) => !a.email || !a.password).map(([r]) => r);

/** เหตุผลที่ต้องข้ามชุดเทสต์นี้ — คืน "" ถ้าพร้อมรัน */
export function skipReason(): string {
  if (!SUPABASE_MODE) return "ข้ามเพราะแอปตั้งเป็นโหมด local (ชุดนี้ทดสอบ backend จริง)";
  if (!SUPABASE_URL || !SUPABASE_ANON) return "ข้ามเพราะ apps/dealer/.env.local ยังไม่มี URL/anon key";
  if (missing.length) return `ข้ามเพราะยังไม่ได้ตั้งบัญชีทดสอบ ${missing.join("/")} — ดู tests/.env.example`;
  return "";
}
