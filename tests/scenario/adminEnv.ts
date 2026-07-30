import { readFileSync } from "node:fs";
import path from "node:path";

// อ่าน service-role key สำหรับ global-setup/global-teardown เท่านั้น (Node-side, ไม่เคยถูกบันเดิลลงเบราว์เซอร์)
// ต่างจาก supabaseEnv.ts (อ่านแค่ anon key ที่ปลอดภัยฝั่ง client)
function readEnvFile(file: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i > 0) out.set(s.slice(0, i).trim(), s.slice(i + 1).trim());
    }
  } catch { /* ไม่มีไฟล์ */ }
  return out;
}

const ROOT = path.join(__dirname, "../..");
const hqVars = readEnvFile(path.join(ROOT, "apps/hq/.env.local"));

export const ADMIN_SUPABASE_URL = hqVars.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
export const ADMIN_SERVICE_ROLE_KEY = hqVars.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
