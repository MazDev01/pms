// แยกให้ชัดว่าเวลาที่เสียไปอยู่ที่ "ฐานข้อมูล" หรือ "แอปของเรา" — ยิงตรงเข้าฐานโดยไม่ผ่าน Next.js
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = (f) => { const m = new Map(); for (const line of readFileSync(f, "utf8").split(String.fromCharCode(10))) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i > 0) m.set(t.slice(0, i).trim(), t.slice(i + 1).trim()); } return m; };
const H = env("apps/hq/.env.local");
const db = createClient(H.get("NEXT_PUBLIC_SUPABASE_URL"), H.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const วัด = async (ชื่อ, fn) => {
  const t0 = Date.now(); const r = await fn(); const ms = Date.now() - t0;
  const n = Array.isArray(r.data) ? r.data.length : (r.data == null ? "-" : "obj");
  console.log("  " + String(ms).padStart(6) + "ms  " + String(n).padEnd(8) + ชื่อ + (r.error ? "  ERROR " + r.error.message.slice(0, 60) : ""));
  return ms;
};

console.log("=== เวลาที่ฐานข้อมูลล้วน ๆ (ไม่ผ่านแอป) ===");
await วัด("ping (วัดเวลาเดินทางพื้นฐาน)", () => db.from("dealers").select("code").limit(1));
await วัด("นับลูกค้าเป้าหมายทั้งหมด", () => db.from("leads").select("id", { count: "exact", head: true }));
await วัด("leads_page หน้าแรก 20", () => db.rpc("leads_page", { p_limit: 20, p_offset: 0, p_status: null,
  p_dealer_codes: null, p_province: null, p_product: null, p_source: null, p_search: null,
  p_date_start: null, p_date_end: null, p_overdue: false, p_as_of: "2026-08-27", p_default_days: 7, p_follow_up_days: {} }));
await วัด("leads_page หน้าที่ 500", () => db.rpc("leads_page", { p_limit: 20, p_offset: 10000, p_status: null,
  p_dealer_codes: null, p_province: null, p_product: null, p_source: null, p_search: null,
  p_date_start: null, p_date_end: null, p_overdue: false, p_as_of: "2026-08-27", p_default_days: 7, p_follow_up_days: {} }));
await วัด("leads_page ค้นหา", () => db.rpc("leads_page", { p_limit: 20, p_offset: 0, p_status: null,
  p_dealer_codes: null, p_province: null, p_product: null, p_source: null, p_search: "ZZVOL-ลูกค้าเป้าหมาย-19999",
  p_date_start: null, p_date_end: null, p_overdue: false, p_as_of: "2026-08-27", p_default_days: 7, p_follow_up_days: {} }));
await วัด("hq_alerts", () => db.rpc("hq_alerts", { p_as_of: "2026-08-27", p_unassigned_default_hours: 24,
  p_lead_idle_days: 7, p_quote_validity_days: 30, p_quote_expiring_days: 7, p_dealer_idle_days: 14,
  p_dealer_codes: null, p_province: null, p_product: null, p_source: null, p_search: null, p_date_start: null, p_date_end: null }));
await วัด("dealer_rollup", () => db.rpc("dealer_rollup", { p_year: 2026, p_as_of: "2026-08-27", p_default_days: 7, p_per_dealer: null }));
await วัด("ดึงลูกค้าเป้าหมายทั้งเครือ 1,000 แถวแรก", () => db.from("leads").select("*").range(0, 999));
