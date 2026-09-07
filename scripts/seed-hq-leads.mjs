// ── นำ "งานก่อสร้าง" ที่เบนจามินติดตามอยู่ เข้าระบบเป็นลูกค้าเป้าหมายของสาขา HQ ─────────
//
// ต้นทาง: ไฟล์ที่เบนจามินส่งมา แผ่น "ก่อสร้าง" 229 รายการ (ก.ค. 68 – ก.ค. 69)
//   • แม่แบบ (master_catalog) สร้างจาก "ประเภทงานที่ลูกค้าถามเข้ามาจริง" ในแผ่นนั้น
//     ⚠️ ราคากลางตั้งเป็น 0 ทุกแม่แบบ — ไฟล์ไม่มีราคาต่อแม่แบบเลย ห้ามเดาให้ (ต้องให้เบนจามินกรอกเอง)
//   • ลูกค้าเป้าหมายผูกกับสาขา HQ (สำนักงานใหญ่ ดูแลทุกภาคทุกจังหวัด)
//
// กติกาการแปลงข้อมูล (เขียนไว้ให้ตรวจย้อนได้ ไม่ใช่เดาเอาเอง):
//   สถานะ  ออกใบเสนอราคาแล้ว(คอลัมน์ Quatation=1) → QUOTED
//          หมายเหตุบอกชัดว่าไม่ได้งาน (จ้างเจ้าอื่น/ราคาไม่ผ่าน/พื้นที่เล็ก/ไม่ตรงงาน) → CANCELLED + เหตุผล
//          นอกนั้น → WAITING (ขั้นแรกของระบบ) · "โทรแล้วหรือยัง" ไปอยู่ที่การติ๊กงาน ไม่ใช่ที่สถานะ
//   ช่องทาง Facebook→Facebook · LINE OA→LINE · DIREC CALL→ลูกค้าเข้ามาเอง · ดีลเลอร์/พี่นิว→แนะนำต่อ
//   ช่องที่ไฟล์ไม่มี (ผู้รับผิดชอบ · ชื่อบริษัท · อีเมล) เว้นว่างไว้ ไม่เติมค่าสมมติ
//
// เลขลูกค้าเป้าหมาย: num_id 1..229 · id "#L-40322" ขึ้นไป (สูตรเดียวกับที่แอปใช้: 40321 + num_id)
//   ไม่ต้องแตะ entity_counters — ตัวนับตั้งต้นเองจาก max(num_id) ตอนสาขาสร้างรายการแรกหลังจากนี้ (0036)
//
// ใช้:  node scripts/seed-hq-leads.mjs           → ดูอย่างเดียว
//       node scripts/seed-hq-leads.mjs --apply   → ลงมือจริง
import { readFileSync } from "node:fs";
import { loadTarget } from "./lib/targetEnv.mjs";

const APPLY = process.argv.includes("--apply");
const DEALER = "HQ";
const { url, serviceKey } = loadTarget();
const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const catalog = JSON.parse(readFileSync("scripts/data/catalog-seed.json", "utf8"));
const leads = JSON.parse(readFileSync("scripts/data/hq-leads-seed.json", "utf8"));

const send = async (method, path, body, prefer) => {
  const r = await fetch(`${url}${path}`, {
    method, headers: prefer ? { ...h, Prefer: prefer } : h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
};

// ── งาน (Checklist) ของแต่ละลูกค้าเป้าหมาย — ใช้แม่แบบงานจริงจากหน้า "เส้นทางการขาย" ของ HQ ──
//   ติ๊กงานถึงขั้นของสถานะ ตามกติกาเดียวกับ syncTasksToStage ใน mock.ts
//   ⚠️ ไม่ใส่ doneAt/doneBy — เราไม่รู้ว่าใครทำเมื่อไหร่ ใส่ไปคือแต่งประวัติการทำงานที่ไม่เคยเกิดขึ้น
//   ⚠️ ติ๊กตาม "หลักฐานในไฟล์" เท่านั้น ไม่ใช่ติ๊กรวดตามขั้นของสถานะแบบข้อมูลตัวอย่าง
//      ในระบบนี้ WAITING = "ติดต่อแล้ว" (ขั้นแรก) ไม่มีขั้น "ยังไม่ได้ติดต่อ"
//      ลีดที่ไฟล์บอกว่ายังไม่ได้โทร จึงอยู่ขั้นแรกแต่ยังไม่ติ๊กงานใด ๆ — ตรงกับความจริง
const journey = JSON.parse((await send("GET", "/rest/v1/hq_sales_journey?select=tasks&id=eq.1")).text);
const TASK_TPL = journey?.[0]?.tasks ?? [];
if (!TASK_TPL.length) { console.error("❌ อ่านแม่แบบงานจาก hq_sales_journey ไม่ได้"); process.exit(1); }
const tasksFor = (l) => {
  const เสร็จ = new Set();
  if (l.called) { เสร็จ.add("contact"); เสร็จ.add("collect"); }        // ไฟล์บอกว่าโทรแล้ว
  if (l.status === "QUOTED") { เสร็จ.add("requirement"); เสร็จ.add("makeQuote"); เสร็จ.add("sendQuote"); } // มีเลขที่ใบเสนอราคา
  if (l.status === "CANCELLED" || l.status === "PAID") เสร็จ.add("close");
  return TASK_TPL.map(t => ({ key: t.key, label: t.label, done: เสร็จ.has(t.key) }));
};

const เดิม = JSON.parse((await send("GET", `/rest/v1/leads?select=id&dealer_code=eq.${DEALER}`)).text);
const แม่แบบเดิม = JSON.parse((await send("GET", "/rest/v1/master_catalog?select=id")).text);
console.log(`\nแม่แบบในฐานตอนนี้: ${แม่แบบเดิม.length} · ในไฟล์: ${catalog.length}`);
console.log(`ลูกค้าเป้าหมายของสาขา ${DEALER} ตอนนี้: ${เดิม.length} · ในไฟล์: ${leads.length}`);
const นับ = (f) => leads.reduce((m, l) => (m[f(l)] = (m[f(l)] ?? 0) + 1, m), {});
console.log("  สถานะ:", JSON.stringify(นับ(l => l.status)));
console.log("  แม่แบบ:", JSON.stringify(นับ(l => l.product || "(ระบุไม่ได้)")));
if (!APPLY) { console.log("\n— โหมดดูอย่างเดียว — ใส่ --apply เพื่อลงมือจริง"); process.exit(0); }

const cat = await send("POST", "/rest/v1/master_catalog?on_conflict=id", catalog, "resolution=merge-duplicates,return=minimal");
console.log("แม่แบบ:", cat.ok ? `บันทึก ${catalog.length} รายการ` : `ไม่สำเร็จ ${cat.status} ${cat.text.slice(0, 200)}`);
if (!cat.ok) process.exit(1);

// ใส่ทีละก้อน — ก้อนใหญ่เกินจะโดนตัดกลางทางแล้วไม่รู้ว่าค้างตรงไหน
let ok = 0;
for (let i = 0; i < leads.length; i += 50) {
  const ก้อน = leads.slice(i, i + 50).map(({ called, ...l }) => ({ ...l, tasks: tasksFor({ ...l, called }), activities: [] }));
  const r = await send("POST", "/rest/v1/leads?on_conflict=dealer_code,id", ก้อน, "resolution=merge-duplicates,return=minimal");
  if (!r.ok) { console.error(`  ก้อนที่ ${i / 50 + 1} ไม่สำเร็จ ${r.status}`, r.text.slice(0, 300)); process.exit(1); }
  ok += ก้อน.length;
  console.log("  บันทึกแล้ว", ok, "รายการ");
}
const หลัง = JSON.parse((await send("GET", `/rest/v1/leads?select=id&dealer_code=eq.${DEALER}`)).text);
console.log(`\nเสร็จ — ลูกค้าเป้าหมายของสาขา ${DEALER} ตอนนี้ ${หลัง.length} รายการ`);
