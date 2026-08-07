// ── ตรวจความพร้อมก่อนนำขึ้นระบบจริง — คำสั่งเดียวจบ ────────────────────────────────
//
// ทำไมต้องมี: การนำขึ้นระบบจริงมีของที่ต้องครบหลายอย่าง และแต่ละอย่างพลาดคนละแบบ
//   ตัวแปรลับหาย → แอปขึ้นได้แต่กดปุ่มไหนก็ไม่ทำงาน (ตอบ 501 เงียบ ๆ)
//   ลืมรัน migration → หน้าจอฟ้อง error ที่ไม่มีใครเข้าใจ
//   ลืมเปิด hook สิทธิ์ → ทุกคนเห็นข้อมูลว่างเปล่าเหมือนไม่มีข้อมูล
//   ไล่เช็กเองทีละอย่างมีวันลืม — รวมไว้ที่เดียวให้เครื่องเช็กแทน
//
// ⚠️ ตัวนี้ตรวจ "สิ่งที่พังแล้วผู้ใช้ใช้งานไม่ได้" เท่านั้น ไม่ได้ตรวจคุณภาพโค้ด
//   (คุณภาพโค้ดมี typecheck/lint/test แยกอยู่แล้ว)
//
// รัน: node scripts/preflight.mjs
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const results = [];
const add = (ok, name, detail = "") => results.push({ ok, name, detail });

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

// ── 1) ตัวแปรที่ขาดไม่ได้ ──
const NEED = {
  "apps/hq/.env.local": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DEALER_SECRET_KEY", "NEXT_PUBLIC_DEALER_APP_URL"],
  "apps/dealer/.env.local": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
};
const hq = readEnvFile("apps/hq/.env.local");
for (const [file, keys] of Object.entries(NEED)) {
  if (!existsSync(file)) { add(false, `ตัวแปรของ ${file}`, "ไม่พบไฟล์"); continue; }
  const env = readEnvFile(file);
  const missing = keys.filter(k => !env[k]);
  add(missing.length === 0, `ตัวแปรของ ${file}`, missing.length ? `ขาด: ${missing.join(", ")}` : `ครบ ${keys.length} ตัว`);
}

// ── 2) โหมดข้อมูลต้องเป็นของจริง ไม่ใช่ข้อมูลตัวอย่างในเครื่อง ──
add(hq.NEXT_PUBLIC_DATA_SOURCE === "supabase", "โหมดข้อมูล", `ตั้งไว้ = ${hq.NEXT_PUBLIC_DATA_SOURCE || "(ไม่ได้ตั้ง)"} · ต้องเป็น supabase`);

// ── 3) ที่อยู่แอปตัวแทนต้องไม่ใช่ localhost ตอนขึ้นระบบจริง ──
const dealerUrl = hq.NEXT_PUBLIC_DEALER_APP_URL ?? "";
add(!!dealerUrl && !/localhost|127\.0\.0\.1/.test(dealerUrl), "ที่อยู่แอปตัวแทน",
  dealerUrl ? `ตั้งไว้ = ${dealerUrl}` : "ไม่ได้ตั้ง — ปุ่ม 'เข้าระบบแทนตัวแทน' จะพาไปผิดที่");

if (!hq.NEXT_PUBLIC_SUPABASE_URL || !hq.SUPABASE_SERVICE_ROLE_KEY) {
  report(); process.exit(1);
}
const svc = createClient(hq.NEXT_PUBLIC_SUPABASE_URL, hq.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(hq.NEXT_PUBLIC_SUPABASE_URL, hq.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// ── 4) ต่อฐานข้อมูลได้จริง ──
{
  const { error } = await svc.from("dealers").select("code").limit(1);
  add(!error, "ต่อฐานข้อมูล", error ? error.message.slice(0, 60) : "ต่อได้");
}

// ── 5) ฟังก์ชันสำคัญต้องถูกติดตั้งครบ (แปลว่า migration รันครบแล้ว) ──
for (const [fn, args] of [["is_account_active", {}], ["next_entity_id", { p_dealer: "RYG", p_entity: "leads" }]]) {
  const { error } = await svc.rpc(fn, args);
  // 42883 = ไม่มีฟังก์ชันนี้ · error อื่นแปลว่ามีฟังก์ชันแต่เงื่อนไขไม่ผ่าน ซึ่งก็ถือว่าติดตั้งแล้ว
  add(error?.code !== "42883", `ฟังก์ชัน ${fn}`, error?.code === "42883" ? "ยังไม่ได้ติดตั้ง — รัน migration ให้ครบ" : "ติดตั้งแล้ว");
}

// ── 6) ผู้ไม่ล็อกอินต้องอ่านข้อมูลไม่ได้เลย ──
{
  const leaks = [];
  for (const t of ["leads", "quotations", "customers", "profiles", "audit_log", "dealers"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    if (!error && (data?.length ?? 0) > 0) leaks.push(t);
  }
  add(leaks.length === 0, "ข้อมูลรั่วถึงคนที่ไม่ได้ล็อกอิน", leaks.length ? `⚠ อ่านได้: ${leaks.join(", ")}` : "ปิดครบทุกตาราง");
}

// ── 7) ต้องมีผู้ดูแลสูงสุดที่ใช้งานได้อย่างน้อย 1 คน (ไม่งั้นเข้าไปจัดการอะไรไม่ได้เลย) ──
{
  const { data } = await svc.from("profiles").select("id").eq("role", "SUPER_ADMIN").eq("status", "active");
  add((data?.length ?? 0) >= 1, "ผู้ดูแลสูงสุดที่ใช้งานได้", `${data?.length ?? 0} บัญชี`);
}

// ── 8) ทุกสาขาต้องมีบัญชีเข้าระบบ (สาขาที่ไม่มีบัญชี = ตัวแทนเข้าใช้งานไม่ได้) ──
{
  const { data: dealers } = await svc.from("dealers").select("code");
  const { data: profs } = await svc.from("profiles").select("dealer_code").neq("dealer_code", "");
  const has = new Set((profs ?? []).map(p => p.dealer_code));
  const orphan = (dealers ?? []).map(d => d.code).filter(c => !has.has(c));
  add(orphan.length === 0, "ทุกสาขามีบัญชีเข้าระบบ", orphan.length ? `⚠ ไม่มีบัญชี: ${orphan.join(", ")}` : `ครบ ${dealers?.length ?? 0} สาขา`);
}

// ── 9) ต้องไม่มีข้อมูลทดสอบปนอยู่กับข้อมูลจริง ──
{
  let junk = 0;
  for (const [t, col] of [["leads", "company"], ["quotations", "customer"], ["customers", "company"], ["dealers", "name"]]) {
    const { count } = await svc.from(t).select("*", { count: "exact", head: true }).like(col, "%ZZ%");
    junk += count ?? 0;
  }
  add(junk === 0, "ข้อมูลทดสอบปนกับข้อมูลจริง", junk ? `⚠ พบ ${junk} รายการที่มีป้าย ZZ` : "ไม่มี");
}

// ── 10) อายุใบผ่านเข้าระบบต้องสั้นพอ (ปิดบัญชีแล้วสิทธิ์ต้องหมดเร็ว) ──
{
  const env2 = readEnvFile("tests/.env.test");
  const email = env2.TEST_RYG_EMAIL, pw = env2.TEST_RYG_PASSWORD;
  if (!email) add(true, "อายุใบผ่านเข้าระบบ", "ข้าม — ไม่มีบัญชีทดสอบให้ตรวจ");
  else {
    const { data, error } = await anon.auth.signInWithPassword({ email, password: pw });
    if (error || !data.session) add(true, "อายุใบผ่านเข้าระบบ", "ข้าม — ล็อกอินทดสอบไม่ได้");
    else {
      const p = JSON.parse(Buffer.from(data.session.access_token.split(".")[1], "base64").toString("utf8"));
      const life = p.exp - p.iat;
      add(life <= 900, "อายุใบผ่านเข้าระบบ", `${life} วินาที (${(life / 60).toFixed(0)} นาที) · ควรไม่เกิน 15 นาที`);
    }
  }
}

report();
function report() {
  console.log("\n══ ตรวจความพร้อมก่อนนำขึ้นระบบจริง ══\n");
  for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name.padEnd(38)} ${r.detail}`);
  const bad = results.filter(r => !r.ok);
  console.log(`\n${bad.length === 0 ? "✅ พร้อมนำขึ้นระบบ" : `❌ ยังไม่พร้อม — ต้องแก้ ${bad.length} ข้อ`}\n`);
}
process.exit(results.some(r => !r.ok) ? 1 : 0);
