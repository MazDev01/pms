// ── ค่าตั้งของสำนักงานใหญ่ที่มีหลักฐานรองรับ — เติมลงระบบจริง ────────────────────────
//
// ที่มาของแต่ละค่า (ไม่มีค่าไหนที่คิดขึ้นเอง):
//   • ที่อยู่ + โทรศัพท์ — ระบบเดิมที่เบนจามินใช้อยู่จริง (Grow CRM ตาราง settings)
//   • เหตุผลที่ปิดการขายไม่สำเร็จ — 4 ข้อเดิมของระบบ + 7 ข้อที่พบในหมายเหตุจริงของไฟล์ "ก่อสร้าง"
//       เช่น "จ้างเจ้าอื่นไปแล้ว" · "พื้นที่ไม่ถึง 300 ตร.ม." · "รองบประมาณปีหน้า" · "ค่าขนส่งลงเกาะสูง"
//
// ⚠️ ช่องที่ยังไม่มีข้อมูลจริง (เลขประจำตัวผู้เสียภาษี · อีเมลกลาง · เว็บไซต์ · เป้ายอดขาย)
//    สคริปต์นี้ "ไม่แตะ" — ปล่อยว่างไว้จนกว่าเบนจามินจะให้มา ห้ามเติมค่าสมมติแทน
//
// ใช้:  node scripts/seed-hq-settings.mjs           → ดูอย่างเดียว
//       node scripts/seed-hq-settings.mjs --apply   → ลงมือจริง
import { loadTarget } from "./lib/targetEnv.mjs";

const APPLY = process.argv.includes("--apply");
const { url, serviceKey } = loadTarget();
const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

const บริษัท = { address: "91/9 ต.อ้อมเกร็ด อ.ปากเกร็ด จ.นนทบุรี 11120", phone: "080-495-2929" };
const เหตุผล = [
  "ราคาสูงเกินงบประมาณ", "คู่แข่งให้ข้อเสนอดีกว่า", "งบประมาณไม่พร้อม", "ลูกค้าไม่ตอบสนอง",
  "จ้างผู้รับเหมารายอื่นไปแล้ว", "ติดต่อลูกค้าไม่ได้", "พื้นที่เล็กกว่าที่รับงาน",
  "เลื่อนโครงการ / รองบประมาณปีหน้า", "ลูกค้ายังไม่มีแบบก่อสร้าง", "ไม่ตรงกับงานที่บริษัทรับ",
  "ค่าขนส่งพื้นที่ห่างไกลสูงเกินไป",
  "อื่นๆ (ระบุเอง)",   // ⚠️ ต้องอยู่ท้ายสุดเสมอ — เป็นตัวเลือก "พิมพ์เหตุผลเอง" ไม่ใช่เหตุผลจริง
];

const send = async (method, path, body) => {
  const r = await fetch(`${url}${path}`, { method, headers: h, body: body && JSON.stringify(body) });
  return { ok: r.ok, status: r.status, text: await r.text() };
};

const เดิมบริษัท = JSON.parse((await send("GET", "/rest/v1/hq_company?select=*&id=eq.1")).text)[0] ?? {};
const เดิมเหตุผล = JSON.parse((await send("GET", "/rest/v1/hq_sales_journey?select=lost&id=eq.1")).text)[0]?.lost ?? [];
console.log("\nข้อมูลบริษัทตอนนี้:");
for (const [k, v] of Object.entries(บริษัท)) console.log(`  ${k}: "${เดิมบริษัท[k] ?? ""}" → "${v}"`);
console.log(`  (ไม่แตะ: เลขผู้เสียภาษี="${เดิมบริษัท.tax_id ?? ""}" อีเมล="${เดิมบริษัท.email ?? ""}" เว็บไซต์="${เดิมบริษัท.website ?? ""}")`);
console.log(`\nเหตุผลที่ปิดไม่สำเร็จ: ${เดิมเหตุผล.length} ข้อ → ${เหตุผล.length} ข้อ`);
console.log("  เพิ่ม:", เหตุผล.filter(r => !เดิมเหตุผล.includes(r)).join(" · ") || "(ไม่มี)");
if (!APPLY) { console.log("\n— โหมดดูอย่างเดียว — ใส่ --apply เพื่อลงมือจริง"); process.exit(0); }

for (const [ตาราง, ค่า] of [["hq_company", บริษัท], ["hq_sales_journey", { lost: เหตุผล }]]) {
  const r = await send("PATCH", `/rest/v1/${ตาราง}?id=eq.1`, ค่า);
  console.log(ตาราง, r.ok ? "บันทึกแล้ว" : `ไม่สำเร็จ ${r.status} ${r.text.slice(0, 200)}`);
  if (!r.ok) process.exit(1);
}
const หลัง = JSON.parse((await send("GET", "/rest/v1/hq_company?select=*&id=eq.1")).text)[0];
console.log("\nผลลัพธ์:", JSON.stringify(หลัง));
