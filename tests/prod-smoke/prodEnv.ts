import { readFileSync } from "node:fs";
import path from "node:path";

// ── ค่าที่ใช้ตรวจ "เว็บใช้งานจริง" หลังอัปโค้ดขึ้น ───────────────────────────────
// อ่านจาก process.env (ตอนรันบน GitHub) หรือ tests/.env.prod (ตอนรันในเครื่อง · โดน .gitignore คุมอยู่)
// ไม่ตั้งค่า = ข้ามพร้อมบอกเหตุผล ไม่ใช่ล้ม — จะได้ไม่บล็อกคนที่ยังไม่มีบัญชีตรวจ

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

const vars = readEnvFile(path.join(__dirname, "../.env.prod"));
const get = (k: string) => process.env[k] ?? vars.get(k) ?? "";

export const HQ_URL     = (get("PROD_HQ_URL")     || "https://benjamin-hq.vercel.app").replace(/\/$/, "");
export const DEALER_URL = (get("PROD_DEALER_URL") || "https://benjamin-dealer.vercel.app").replace(/\/$/, "");

export const HQ_ACCOUNT     = { email: get("PROD_ADMIN_EMAIL"),  password: get("PROD_ADMIN_PASSWORD") };
export const DEALER_ACCOUNT = { email: get("PROD_DEALER_EMAIL"), password: get("PROD_DEALER_PASSWORD") };

export function skipReason(who: "hq" | "dealer"): string {
  const a = who === "hq" ? HQ_ACCOUNT : DEALER_ACCOUNT;
  const keys = who === "hq" ? "PROD_ADMIN_EMAIL/PROD_ADMIN_PASSWORD" : "PROD_DEALER_EMAIL/PROD_DEALER_PASSWORD";
  if (!a.email || !a.password) return `ข้ามเพราะยังไม่ได้ตั้งบัญชีตรวจเว็บจริง (${keys}) — ดู docs/ตรวจเว็บจริงหลังอัปโค้ด.md`;
  return "";
}
