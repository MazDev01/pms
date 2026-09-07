// ── ใบเสนอราคาที่ไฟล์ของเบนจามินบันทึกไว้ว่า "ออกให้ลูกค้าแล้ว" → เข้าระบบเป็นใบของสาขา HQ ──
//
// เลขที่เอกสาร: **ออกใหม่ทั้งหมดตามรูปแบบของระบบ** Q-{รหัสสาขา}-{ปี}-{เลขรัน 4 หลัก}
//   (บอสสั่ง 7 ก.ย. 69 — เลขเดิมในไฟล์เป็นเลขของระบบเก่า คนละชุดกับที่ระบบนี้ออกให้)
//   เลขเดิมเก็บไว้ในช่องหมายเหตุของใบ จะได้ตามกลับไปหาเอกสารเดิมได้
//   นับต่อจากตัวนับของสาขาจริง (quote_counters) แล้วเลื่อนตัวนับให้ตรง — ใบที่ออกหลังจากนี้จะไม่ชนกัน
//
// ข้อมูลอื่นเอาตามที่ไฟล์มี — ช่องไหนไฟล์ไม่ได้กรอกก็ปล่อยว่าง ไม่เติมตัวเลขสมมติ
//   ⚠️ ไฟล์ไม่มีรายการ BOQ ของใบพวกนี้ → line_items ว่าง · items = 0 · ต้นทุนวัสดุ 0
//
// ใช้:  node scripts/seed-hq-quotations.mjs           → ดูอย่างเดียว
//       node scripts/seed-hq-quotations.mjs --apply   → ลงมือจริง
import { loadTarget } from "./lib/targetEnv.mjs";

const APPLY = process.argv.includes("--apply");
const DEALER = "HQ";
const PREFIX = "Q-";                       // ป้ายนำหน้ามาตรฐานของระบบ (mock.QUOTE_PREFIX)
const YEAR = "2026";                       // ปีของเอกสารชุดนี้ (ไฟล์ระบุ ม.ค. 2026)
const { url, serviceKey } = loadTarget();
const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const send = async (method, path, body, prefer) => {
  const r = await fetch(`${url}${path}`, { method, headers: prefer ? { ...h, Prefer: prefer } : h, body: body && JSON.stringify(body) });
  return { ok: r.ok, status: r.status, text: await r.text() };
};

// เรียงตามลำดับแถวในไฟล์ · dealId = เลขลูกค้าเป้าหมายของสาขาที่ใบนี้ออกให้
const ใบ = [
  { dealId: 42,  customer: "คุณบงกช", project: "งานก่อสร้าง คุณบงกช", value: 0, area: "",
    province: "ชลบุรี", buildingType: "โกดังและคลังสินค้า", เดิม: "", แถว: 51,
    ขาด: "ไฟล์กรอกยอดเงิน/วันที่ไว้เป็น ??? ทั้งหมด" },
  { dealId: 44,  customer: "K.TOP", project: "SP Lampadari Warehouse", value: 2931800, area: "",
    province: "กรุงเทพมหานคร", buildingType: "โกดังและคลังสินค้า", เดิม: "QT2026-01-006", แถว: 53 },
  { dealId: 54,  customer: "คุณสุรพล", project: "งานก่อสร้าง คุณสุรพล ฉะเชิงเทรา", value: 6500000, area: "3000",
    province: "ฉะเชิงเทรา", buildingType: "", เดิม: "", แถว: 63 },
  { dealId: 56,  customer: "คุณปาน", project: "งานก่อสร้าง คุณปาน วัดโสธร", value: 6500000, area: "4000",
    province: "ฉะเชิงเทรา", buildingType: "สนามกีฬาในร่ม", เดิม: "", แถว: 65 },
  { dealId: 143, customer: "บริษัท กลอรี่ ซี.จี. จำกัด", project: "SINTA WH Project", value: 0, area: "6675",
    province: "สมุทรปราการ", buildingType: "โรงงาน", เดิม: "QT2026-01-004", แถว: 155 },
];
const เงิน = (n) => n ? "฿" + n.toLocaleString("en-US") : "";

// ── ล้างใบชุดเดิมที่เคยนำเข้าด้วยเลขของระบบเก่า (ถ้ามี) ──
const เดิม = JSON.parse((await send("GET", `/rest/v1/quotations?select=id,quote_no&dealer_code=eq.${DEALER}`)).text);
const ต้องลบ = เดิม.filter(q => !q.id.startsWith(`${PREFIX}${DEALER}-`));
// ── เลขรันถัดไปของสาขา (ตัวเดียวกับที่ระบบใช้ตอนสาขาออกใบเอง) ──
const counter = JSON.parse((await send("GET", `/rest/v1/quote_counters?select=next_no&dealer_code=eq.${DEALER}`)).text);
const เริ่มที่ = counter[0]?.next_no ?? 1;
const เลขที่ = (i) => `${PREFIX}${DEALER}-${YEAR}-${String(เริ่มที่ + i).padStart(4, "0")}`;

console.log(`\nใบของสาขา ${DEALER} ตอนนี้: ${เดิม.length} ใบ · จะลบใบเลขระบบเก่า ${ต้องลบ.length} ใบ`);
console.log(`ออกเลขใหม่เริ่มที่ ${เลขที่(0)} (ตัวนับสาขาอยู่ที่ ${เริ่มที่})\n`);
ใบ.forEach((q, i) => console.log(`  ${เลขที่(i)} · ${q.customer} · ${q.project} · ${เงิน(q.value) || "ไม่ระบุยอด"}` +
  `${q.area ? " · " + q.area + " ตร.ม." : ""} · ลีด #${q.dealId}${q.เดิม ? ` · เลขเดิม ${q.เดิม}` : ""}`));
if (!APPLY) { console.log("\n— โหมดดูอย่างเดียว — ใส่ --apply เพื่อลงมือจริง"); process.exit(0); }

for (const q of ต้องลบ) {
  const r = await send("DELETE", `/rest/v1/quotations?dealer_code=eq.${DEALER}&id=eq.${encodeURIComponent(q.id)}`, undefined, "return=minimal");
  console.log(`ลบใบเลขเดิม ${q.id}:`, r.ok ? "แล้ว" : `ไม่สำเร็จ ${r.status}`);
  if (!r.ok) process.exit(1);
}

const แถว = ใบ.map((q, i) => ({
  id: เลขที่(i), quote_no: เลขที่(i), dealer_code: DEALER, deal_id: q.dealId,
  customer: q.customer, project: q.project,
  total: เงิน(q.value), total_value: q.value, material_cost: 0,
  province: q.province, building_type: q.buildingType, area: q.area,
  status: "sent_to_client", date: "2026-01-29", items: 0, line_items: [],
  note: [`นำเข้าจากไฟล์ติดตามงานก่อสร้างของเบนจามิน (แผ่น ก่อสร้าง แถว ${q.แถว})`,
         q.เดิม ? `เลขที่เอกสารเดิมในระบบเก่า: ${q.เดิม}` : "",
         q.ขาด ?? "", "ไฟล์ไม่มีรายการวัสดุ (BOQ) ของใบนี้"].filter(Boolean).join(" · "),
}));
const ins = await send("POST", "/rest/v1/quotations", แถว, "return=minimal");
console.log("บันทึกใบใหม่:", ins.ok ? `${แถว.length} ใบ` : `ไม่สำเร็จ ${ins.status} ${ins.text.slice(0, 300)}`);
if (!ins.ok) process.exit(1);

// เลื่อนตัวนับของสาขาให้ต่อจากใบสุดท้าย — ไม่งั้นใบที่สาขาออกเองจะได้เลขซ้ำกับที่นำเข้า
const upd = await send("POST", "/rest/v1/quote_counters?on_conflict=dealer_code",
  { dealer_code: DEALER, next_no: เริ่มที่ + แถว.length }, "resolution=merge-duplicates,return=minimal");
console.log("ตัวนับเลขที่ใบของสาขา:", upd.ok ? `ถัดไป = ${เริ่มที่ + แถว.length}` : `ไม่สำเร็จ ${upd.status}`);

// ลีดที่ออกใบให้แล้ว ต้องอยู่ขั้น "เสนอราคา" และติ๊กงานจัดทำ/ส่งใบให้ตรงกัน
const journey = JSON.parse((await send("GET", "/rest/v1/hq_sales_journey?select=tasks&id=eq.1")).text)[0].tasks;
for (const q of ใบ) {
  const lead = JSON.parse((await send("GET", `/rest/v1/leads?select=tasks&dealer_code=eq.${DEALER}&num_id=eq.${q.dealId}`)).text)[0];
  if (!lead) { console.error("ไม่พบลีด", q.dealId); continue; }
  const เสร็จ = new Set(lead.tasks.filter(t => t.done).map(t => t.key));
  ["contact", "collect", "requirement", "makeQuote", "sendQuote"].forEach(k => เสร็จ.add(k));
  const r = await send("PATCH", `/rest/v1/leads?dealer_code=eq.${DEALER}&num_id=eq.${q.dealId}`,
    { status: "QUOTED", tasks: journey.map(t => ({ key: t.key, label: t.label, done: เสร็จ.has(t.key) })) });
  if (!r.ok) console.error("อัปเดตลีด", q.dealId, "ไม่สำเร็จ", r.text.slice(0, 150));
}
const หลัง = JSON.parse((await send("GET", `/rest/v1/quotations?select=id,customer,total_value,deal_id,status&dealer_code=eq.${DEALER}&order=id`)).text);
console.log("\nผลลัพธ์:"); หลัง.forEach(q => console.log(" ", q.id, "·", q.customer, "·", q.total_value, "· ลีด", q.deal_id, "·", q.status));
