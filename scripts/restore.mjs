// ── กู้คืนข้อมูลจากไฟล์สำรอง ────────────────────────────────────────────────────────
//
// คู่กับ scripts/backup.mjs — ดูเหตุผลที่ต้องมีระบบนี้ได้ที่หัวไฟล์นั้น
//
// ⚠️ ข้อสำคัญที่สุด: **ระบบสำรองข้อมูลที่ไม่เคยทดลองกู้ ไม่นับว่ามีระบบสำรองข้อมูล**
//   ที่เจอบ่อยคือสำรองไว้ทุกวันอย่างขยันขันแข็ง แต่วันที่ต้องใช้จริงกลับกู้ไม่ได้
//   สคริปต์นี้จึงถูกทดลองกู้ของจริงมาแล้ว (ดูขั้นตอนในคู่มือ docs/BACKUP.md)
//
// สองโหมด — ปลอดภัยไว้ก่อนเป็นค่าตั้งต้น:
//   node scripts/restore.mjs <โฟลเดอร์>           → **ตรวจอย่างเดียว** ไม่แตะฐานข้อมูล
//                                                    บอกว่าของในไฟล์กับในฐานข้อมูลต่างกันตรงไหน
//   node scripts/restore.mjs <โฟลเดอร์> --apply   → กู้คืนจริง (ต้องพิมพ์ --yes ยืนยันด้วย)
//
// วิธีเขียนกลับ: ใช้ "ทับของเดิมถ้ามี เพิ่มถ้าไม่มี" (upsert)
//   จึงกู้เฉพาะสิ่งที่หาย ไม่ไปลบของใหม่ที่เกิดขึ้นหลังวันสำรอง
//   ⚠️ แปลว่าตัวนี้ไม่ได้ "ย้อนเวลากลับ" — แถวที่ถูกลบไปหลังสำรองจะกลับมา
//      แต่แถวที่เพิ่มเข้ามาใหม่จะยังอยู่ ซึ่งเป็นพฤติกรรมที่ต้องการในกรณี "ลบผิด"
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const APPLY = process.argv.includes("--apply");
const YES = process.argv.includes("--yes");

if (!dir || !existsSync(dir)) {
  console.error("ใช้: node scripts/restore.mjs <โฟลเดอร์สำรอง> [--apply --yes]");
  process.exit(1);
}
if (APPLY && !YES) {
  console.error("\n⚠️  --apply จะเขียนทับข้อมูลในฐานข้อมูลจริง — ต้องใส่ --yes ยืนยันด้วย\n");
  process.exit(1);
}

function readEnvFile(file) {
  const out = {};
  try {
    for (const l of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* ไม่มีไฟล์ */ }
  return out;
}
const env = readEnvFile("apps/hq/.env.local");
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));

// ลำดับที่ควรเขียนก่อน — ตารางแม่ต้องมาก่อนตารางลูก ไม่งั้นฐานข้อมูลปฏิเสธเพราะอ้างถึงของที่ยังไม่มี
// (เป็นแค่ "คำใบ้" เพื่อให้จบเร็ว ถ้าลำดับยังไม่พอ ตัวโปรแกรมจะวนซ้ำให้เองด้านล่าง)
const ORDER = [
  "dealers", "dealers_directory", "profiles", "master_catalog",
  "hq_company", "hq_policy", "hq_targets", "hq_notif_rules", "hq_sales_journey",
  "dealer_settings", "dealer_lead_rules", "dealer_login_secrets",
  "entity_counters", "quote_counters", "responsible_persons",
  "customers", "leads", "quotations", "appointments", "customer_notes", "files",
  "audit_log", "rate_limits",
];

// ตารางที่เป็น "สถานะชั่วคราว" — สำรองไว้ดูได้ แต่ห้ามกู้ทับ
//   rate_limits = ตัวนับกันยิงถี่ เปลี่ยนค่าตลอดเวลาทุกครั้งที่มีคนเรียก API
//   เอาค่าเก่ามาทับ = รีเซ็ตตัวนับของคนที่กำลังถูกจำกัดอยู่ กลายเป็นเปิดช่องให้ยิงใหม่ได้
//   และเทียบแล้วจะขึ้น "ต่างกัน" ทุกครั้งจนคนอ่านรายงานเลิกสนใจสัญญาณเตือน
const TRANSIENT = new Set(["rate_limits"]);

const tables = readdirSync(dir)
  .filter(f => f.endsWith(".json") && f !== "manifest.json" && !f.startsWith("_"))
  .map(f => f.replace(/\.json$/, ""))
  .filter(t => !TRANSIENT.has(t))
  .sort((a, b) => {
    const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

const keyOf = (row, pk) => pk.map(c => String(row[c])).join("␟");
const PAGE = 1000;

/** อ่านทั้งตารางจากฐานข้อมูล (ไล่ทีละหน้า — ขอทีเดียวได้กลับมาแค่ 1,000 แถว) */
async function readAll(table, pk) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = svc.from(table).select("*").range(from, from + PAGE - 1);
    for (const c of pk) q = q.order(c, { ascending: true });
    const { data, error } = await q;
    if (error) return { rows: [], error: error.message };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return { rows };
}

console.log(`\n══ ${APPLY ? "กู้คืนข้อมูลจริง" : "ตรวจเทียบไฟล์สำรองกับฐานข้อมูล (ไม่แตะข้อมูล)"} ══`);
console.log(`   ไฟล์สำรองเมื่อ: ${manifest.at}\n`);

const report = [];
const pending = [];   // ตารางที่ต้องเขียนกลับ

for (const table of tables) {
  const pk = manifest.tables?.[table]?.pk ?? ["id"];
  const dump = JSON.parse(readFileSync(path.join(dir, `${table}.json`), "utf8"));
  const { rows: live, error } = await readAll(table, pk);
  if (error) { report.push({ table, note: `อ่านไม่ได้: ${error.slice(0, 50)}` }); continue; }

  const liveMap = new Map(live.map(r => [keyOf(r, pk), r]));
  const missing = [];   // มีในไฟล์สำรอง แต่หายไปจากฐานข้อมูล
  const differ = [];    // มีทั้งสองที่ แต่เนื้อหาไม่ตรงกัน
  for (const r of dump) {
    const k = keyOf(r, pk);
    const cur = liveMap.get(k);
    if (!cur) missing.push(r);
    else if (JSON.stringify(r) !== JSON.stringify(Object.fromEntries(Object.keys(r).map(c => [c, cur[c]])))) differ.push(r);
  }
  const added = live.length - (dump.length - missing.length);   // แถวใหม่ที่เกิดหลังวันสำรอง
  report.push({ table, dump: dump.length, live: live.length, missing: missing.length, differ: differ.length, added });
  if (missing.length || differ.length) pending.push({ table, pk, rows: [...missing, ...differ] });
}

for (const r of report) {
  if (r.note) { console.log(`  ⚠️  ${r.table.padEnd(24)} ${r.note}`); continue; }
  const flag = r.missing || r.differ ? "🔴" : "✅";
  const detail = r.missing || r.differ
    ? `หาย ${r.missing} · ต่างกัน ${r.differ}`
    : (r.added > 0 ? `ตรงกัน (มีใหม่หลังสำรอง ${r.added})` : "ตรงกัน");
  console.log(`  ${flag} ${r.table.padEnd(24)} ไฟล์ ${String(r.dump).padStart(6)} · ฐานข้อมูล ${String(r.live).padStart(6)}   ${detail}`);
}

const needFix = report.reduce((n, r) => n + (r.missing ?? 0) + (r.differ ?? 0), 0);

if (!APPLY) {
  console.log(`\n${needFix ? `🔴 ต้องกู้คืน ${needFix} แถว — สั่ง --apply --yes เพื่อกู้จริง` : "✅ ข้อมูลในฐานข้อมูลครบตรงกับไฟล์สำรอง"}`);
  if (manifest.warnings?.length) { console.log(""); for (const w of manifest.warnings) console.log(`  ⚠️  ${w}`); }
  console.log("");
  process.exit(0);
}

// ── เขียนกลับจริง ──
// วนซ้ำหลายรอบ: รอบแรกบางตารางอาจยังเขียนไม่ได้เพราะอ้างถึงตารางที่ยังไม่ถูกกู้
// รอบถัดไปตารางแม่กู้เสร็จแล้วก็จะผ่านเอง — วนจนไม่มีอะไรคืบหน้าแล้วค่อยยอมแพ้
console.log("");
let queue = pending, pass = 0;
while (queue.length && pass < 4) {
  pass++;
  const stuck = [];
  for (const item of queue) {
    let ok = 0, err = null;
    for (let i = 0; i < item.rows.length; i += 500) {
      const chunk = item.rows.slice(i, i + 500);
      const { error } = await svc.from(item.table).upsert(chunk, { onConflict: item.pk.join(",") });
      // ⚠️ ฐานข้อมูลตัวนี้คืน error เป็น "ค่า" ไม่ได้โยนข้อผิดพลาด — ไม่เช็กเอง = พังเงียบ
      if (error) { err = error.message; break; }
      ok += chunk.length;
    }
    if (err) stuck.push(item);
    else console.log(`  ✅ ${item.table.padEnd(24)} กู้คืน ${ok} แถว`);
    if (err && pass === 4) console.log(`  ❌ ${item.table.padEnd(24)} ${err.slice(0, 70)}`);
  }
  if (stuck.length === queue.length) { queue = stuck; break; }   // ไม่คืบหน้าแล้ว
  queue = stuck;
}

// ── ปรับตัวนับเลขอัตโนมัติ — ขาดขั้นนี้ = กู้เสร็จดูปกติ แต่บันทึกรายการใหม่ไม่ได้เลย ──
{
  const { error } = await svc.rpc("restore_sync_sequences");
  console.log(error
    ? `\n  ❌ ปรับตัวนับเลขอัตโนมัติไม่สำเร็จ: ${error.message.slice(0, 70)}\n     (ถ้ายังไม่ได้ติดตั้ง migration 0131 ให้รัน npx supabase db push ก่อน)`
    : "\n  ✅ ปรับตัวนับเลขอัตโนมัติให้ตรงกับข้อมูลแล้ว");
}

console.log(`\n${queue.length ? `❌ ยังกู้ไม่ได้ ${queue.length} ตาราง: ${queue.map(q => q.table).join(", ")}` : "✅ กู้คืนครบแล้ว"}`);
console.log("   แนะนำ: รัน node scripts/restore.mjs " + dir + " อีกครั้ง (โหมดตรวจ) เพื่อยืนยันว่าครบจริง");
if (existsSync(path.join(dir, "_auth_users.json"))) {
  console.log("   ⚠️  บัญชีผู้ใช้ไม่ได้ถูกกู้ (สำรองรหัสผ่านไม่ได้) — ดูรายชื่อได้ที่ _auth_users.json แล้วสร้างใหม่พร้อมตั้งรหัสผ่านใหม่");
}
console.log("");
process.exit(queue.length ? 1 : 0);
