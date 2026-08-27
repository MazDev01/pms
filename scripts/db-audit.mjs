// ตรวจฐานข้อมูลจริง: โครงตาราง คอลัมน์ คีย์ ข้อบังคับ ทริกเกอร์ (ยิงจริง ไม่ได้อ่านโค้ด)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = (f) => { const m = new Map(); for (const line of readFileSync(f, "utf8").split(String.fromCharCode(10))) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i > 0) m.set(t.slice(0, i).trim(), t.slice(i + 1).trim()); } return m; };
const H = env("apps/hq/.env.local");
const URL_ = H.get("NEXT_PUBLIC_SUPABASE_URL"), KEY = H.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !KEY) { console.error("ไม่มีคีย์ระดับระบบใน apps/hq/.env.local"); process.exit(1); }
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

console.log("ฐานข้อมูลที่ตรวจ: " + URL_);
console.log("");
console.log("=== 1) โครงสร้างตาราง (จาก OpenAPI ของ PostgREST) ===");
const spec = await (await fetch(URL_ + "/rest/v1/", { headers: { apikey: KEY, authorization: "Bearer " + KEY } })).json();
const defs = spec.definitions ?? {};
const names = Object.keys(defs).sort();
console.log("จำนวนตาราง/วิว: " + names.length);
let pkMissing = [], fkList = [], notNullCount = 0, colCount = 0;
for (const t of names) {
  const props = defs[t].properties ?? {};
  const cols = Object.keys(props);
  colCount += cols.length;
  const pk = cols.filter(c => (props[c].description ?? "").includes("Primary Key"));
  const fk = cols.filter(c => (props[c].description ?? "").includes("Foreign Key"));
  const req = defs[t].required ?? [];
  notNullCount += req.length;
  if (!pk.length) pkMissing.push(t);
  for (const c of fk) fkList.push(t + "." + c + " -> " + (props[c].description.match(/`(.+?)`/)?.[1] ?? "?"));
  console.log("  " + t.padEnd(24) + " คอลัมน์ " + String(cols.length).padStart(3) + " · PK " + (pk.join(",") || "-").padEnd(14) + " · NOT NULL " + req.length + " · FK " + (fk.join(",") || "-"));
}
console.log("");
console.log("รวมคอลัมน์ " + colCount + " · ตารางที่ไม่มี PK: " + (pkMissing.join(", ") || "ไม่มี"));
console.log("ความสัมพันธ์ FK ทั้งหมด:");
for (const f of fkList) console.log("  " + f);
