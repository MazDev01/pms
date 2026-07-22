// Seed แคตตาล็อกแม่แบบ/ราคากลาง (solutionProducts จาก mock.ts) เข้าตาราง master_catalog
// ใช้บัญชี HQ (is_hq) เขียน — ไม่ต้องใช้ service_role · idempotent (upsert ตาม id)
//
// รัน:  node supabase/seed-catalog.mjs
// จำเป็นเมื่อใช้ NEXT_PUBLIC_DATA_SOURCE=supabase — ไม่งั้นหน้า "แม่แบบ" ของตัวแทนจะว่าง
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(here, "..", "packages", "shared", "lib", "mock.ts");

// mock.ts ไม่มี import ใด ๆ → transpile แล้วรันตรง ๆ เพื่อดึงข้อมูลจริงออกมา (แหล่งเดียวกับที่แอปใช้)
const js = ts.transpileModule(readFileSync(MOCK, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", "require", js)(mod.exports, mod, require);
const { solutionProducts } = mod.exports;
if (!Array.isArray(solutionProducts) || !solutionProducts.length) {
  console.error("❌ อ่าน solutionProducts จาก mock.ts ไม่ได้"); process.exit(1);
}

const URL = process.env.SUPABASE_URL || "https://yhhhcrvhkforwsagojho.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_zr65SqX0o0mg0QwYZUucxA_BGNhvlKn";
const EMAIL = process.env.HQ_EMAIL || "admin@benjamin.com";
const PASSWORD = process.env.HQ_PASSWORD || "benjamin";

const c2s = (k) => k.replace(/[A-Z]/g, (ch) => "_" + ch.toLowerCase());
const toSnake = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [c2s(k), v]));

const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const { error: se } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (se) { console.error("❌ ล็อกอิน HQ ไม่สำเร็จ:", se.message); process.exit(1); }

const rows = solutionProducts.map(toSnake);
const { error } = await sb.from("master_catalog").upsert(rows, { onConflict: "id" });
if (error) { console.error("❌ upsert ล้มเหลว:", error.message); process.exit(1); }

const { data } = await sb.from("master_catalog").select("id,name,price").order("id");
console.log(`✓ seed แคตตาล็อก ${rows.length} รายการ → master_catalog มีทั้งหมด ${(data ?? []).length} รายการ`);
for (const p of data ?? []) console.log(`   · ${p.id} — ${p.name} (฿${Number(p.price).toLocaleString("th-TH")})`);
