// ── ใบเสนอราคาที่ "มีเลขที่เอกสารจริง" ในไฟล์ของเบนจามิน → เข้าระบบเป็นใบของสาขา HQ ────
//
// ในไฟล์แผ่น "ก่อสร้าง" มีคอลัมน์ "เลขที่ใบเสนอราคา" ที่กรอกไว้จริง 2 ใบเท่านั้น
// อีก 2 แถวมีแต่ยอดเงิน (6.5 ล้าน) โดยไม่มีเลขที่เอกสาร — ไม่นำเข้า เพราะจะต้องตั้งเลขที่ขึ้นเอง
//   (ยอดของสองแถวนั้นบันทึกไว้ที่ "มูลค่า" ของลูกค้าเป้าหมายแล้ว ไม่ได้หายไปไหน)
//
// ⚠️ ไฟล์ไม่มีรายการ BOQ (รายการวัสดุ/ปริมาณ) ของใบพวกนี้ → line_items ว่าง · items = 0
//    ต้นทุนวัสดุไม่รู้ → material_cost = 0 · ไม่ใส่ตัวเลขสมมติแทน
// ⚠️ ตัวนับเลขที่ใบของสาขาไม่ถูกแตะ — ใบที่สาขาออกเองหลังจากนี้จะเริ่มที่ Q-2026-0001 ตามปกติ
//    (เลขในไฟล์เป็นเลขของระบบเดิม คนละชุดกัน)
//
// ใช้:  node scripts/seed-hq-quotations.mjs           → ดูอย่างเดียว
//       node scripts/seed-hq-quotations.mjs --apply   → ลงมือจริง
import { loadTarget } from "./lib/targetEnv.mjs";

const APPLY = process.argv.includes("--apply");
const DEALER = "HQ";
const { url, serviceKey } = loadTarget();
const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const send = async (method, path, body, prefer) => {
  const r = await fetch(`${url}${path}`, { method, headers: prefer ? { ...h, Prefer: prefer } : h, body: body && JSON.stringify(body) });
  return { ok: r.ok, status: r.status, text: await r.text() };
};

// deal_id = เลขลูกค้าเป้าหมายของสาขา (num_id) ที่ใบนี้ออกให้ — ผูกไว้จะได้เปิดจากหน้าลีดได้
const ใบ = [
  {
    id: "QT2026-01-006", quote_no: "QT2026-01-006", dealer_code: DEALER,
    customer: "K.TOP", project: "SP Lampadari Warehouse",
    total: "฿2,931,800", total_value: 2931800, material_cost: 0,
    province: "กรุงเทพมหานคร", building_type: "โกดังและคลังสินค้า", area: "",
    status: "sent_to_client", date: "2026-01-29", items: 0, line_items: [], deal_id: 44,
    note: "นำเข้าจากไฟล์ติดตามงานก่อสร้างของเบนจามิน (แผ่น ก่อสร้าง แถว 53) — ไฟล์ไม่มีรายการวัสดุของใบนี้",
  },
  {
    id: "QT2026-01-004", quote_no: "QT2026-01-004", dealer_code: DEALER,
    customer: "บริษัท กลอรี่ ซี.จี. จำกัด", project: "SINTA WH Project",
    total: "", total_value: 0, material_cost: 0,
    province: "สมุทรปราการ", building_type: "โกดังและคลังสินค้า", area: "6675",
    status: "sent_to_client", date: "2026-01-29", items: 0, line_items: [], deal_id: 143,
    note: "นำเข้าจากไฟล์ติดตามงานก่อสร้างของเบนจามิน (แผ่น ก่อสร้าง แถว 155) — ไฟล์ไม่ได้กรอกยอดเงินของใบนี้",
  },
];

const เดิม = JSON.parse((await send("GET", `/rest/v1/quotations?select=id&dealer_code=eq.${DEALER}`)).text);
console.log(`\nใบเสนอราคาของสาขา ${DEALER} ตอนนี้: ${เดิม.length} ใบ · ในไฟล์: ${ใบ.length} ใบ`);
ใบ.forEach(q => console.log(`  ${q.quote_no} · ${q.customer} · ${q.project} · ${q.total || "ไม่ระบุยอด"} · ${q.date}`));
if (!APPLY) { console.log("\n— โหมดดูอย่างเดียว — ใส่ --apply เพื่อลงมือจริง"); process.exit(0); }

const r = await send("POST", "/rest/v1/quotations?on_conflict=dealer_code,id", ใบ, "resolution=merge-duplicates,return=minimal");
console.log(r.ok ? "บันทึกแล้ว" : `ไม่สำเร็จ ${r.status} ${r.text.slice(0, 300)}`);
if (!r.ok) process.exit(1);
const หลัง = JSON.parse((await send("GET", `/rest/v1/quotations?select=id,quote_no,customer,total_value,status&dealer_code=eq.${DEALER}`)).text);
console.log("ผลลัพธ์:", JSON.stringify(หลัง));
