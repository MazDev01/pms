// ─── ชุดข้อมูลระดับเครือ (Network-scale mock) สำหรับมุมมอง HQ ──────────────────
// สร้างแบบ deterministic (seeded RNG · ไม่มี Math.random/Date.now) → server/client ตรงกัน กัน hydration mismatch
// ใช้เฉพาะฝั่ง HQ เพื่อให้ตัวเลขสมจริงทั้งเครือ (ตัวแทน 48 · ลีด ~1,250 · ลูกค้า ~820 · ใบเสนอราคา ~670)
import { dealerLeaderboard, type DealerRow, type HQQuotation, type HQCustomer, type LeadRow, type LeadStatus, type QuotationStatus } from "./mock";

// mulberry32 — RNG แบบกำหนดค่าเริ่มต้นได้ (คงที่ทุกครั้ง)
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

const PROVINCES: { p: string; r: string }[] = [
  { p: "เชียงใหม่", r: "เหนือ" }, { p: "เชียงราย", r: "เหนือ" }, { p: "ลำพูน", r: "เหนือ" }, { p: "น่าน", r: "เหนือ" }, { p: "พิษณุโลก", r: "เหนือ" },
  { p: "นครสวรรค์", r: "กลาง" }, { p: "พระนครศรีอยุธยา", r: "กลาง" }, { p: "สระบุรี", r: "กลาง" }, { p: "ลพบุรี", r: "กลาง" }, { p: "กรุงเทพมหานคร", r: "กลาง" },
  { p: "ระยอง", r: "ตะวันออก" }, { p: "ชลบุรี", r: "ตะวันออก" }, { p: "ฉะเชิงเทรา", r: "ตะวันออก" }, { p: "ปราจีนบุรี", r: "ตะวันออก" },
  { p: "ขอนแก่น", r: "อีสาน" }, { p: "อุบลราชธานี", r: "อีสาน" }, { p: "นครราชสีมา", r: "อีสาน" }, { p: "อุดรธานี", r: "อีสาน" }, { p: "ร้อยเอ็ด", r: "อีสาน" },
  { p: "ตาก", r: "ตะวันตก" }, { p: "กาญจนบุรี", r: "ตะวันตก" }, { p: "ราชบุรี", r: "ตะวันตก" }, { p: "เพชรบุรี", r: "ตะวันตก" },
  { p: "สงขลา", r: "ใต้" }, { p: "ภูเก็ต", r: "ใต้" }, { p: "สุราษฎร์ธานี", r: "ใต้" }, { p: "นครศรีธรรมราช", r: "ใต้" }, { p: "กระบี่", r: "ใต้" },
];
const PRODUCTS = ["โกดังสำเร็จรูป", "โรงงานสำเร็จรูป", "อาคารสำนักงาน", "ศูนย์กระจายสินค้า", "อาคารพาณิชย์", "โรงงานอาหาร", "อาคารเกษตรกรรม", "สนามกีฬาในร่ม"];
const SOURCES = ["เว็บไซต์", "โทรเข้า", "แนะนำ", "งานแสดงสินค้า", "Facebook", "LINE", "Walk-in"];
const LOST_REASONS = ["ราคา", "คู่แข่ง", "งบประมาณ", "ลูกค้าเลื่อน", "ติดต่อไม่ได้", "อื่นๆ"];
const SALES = ["สมชาย เชียงใหม่", "วิภา รัตนกุล", "กาญจนา มีสุข", "ธนา ศรีสุข", "ปิยะ วงศ์ดี", "อรุณ แสงทอง", "มานพ ใจดี", "สุดา พงษ์เจริญ"];
const CO_PREFIX = ["บจ.", "หจก.", "บมจ."];
const CO_NAME = ["ไทยสตีล", "ซีซีเอส", "อุตรดิตถ์โลหะ", "ลำปางแพ็คเกจจิ้ง", "พิษณุโลกฟาร์ม", "เชียงรายฟู้ดส์", "นครสวรรค์โลหะ", "ราชบุรีโลหะ", "แพร่วู้ดโปรดักส์", "น่านโลจิสติกส์", "สยามเมทัล", "โปรบิลด์", "เอเชียคอนกรีต", "ยูนิตี้สตีล", "เมกาโฮม", "ไพศาลพาณิชย์", "รุ่งเรืองกิจ", "ทรัพย์ทวี", "กิจเจริญ", "ศรีสุขภัณฑ์"];
const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."]; // ครึ่งปีปัจจุบัน (2569)
const MO_PREV = ["ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]; // ครึ่งปีก่อนหน้า (2568) — ไว้เทียบเทรนด์
const thaiDate = (r: () => number) => `${int(r, 1, 28)} ${pick(r, MO)} 2569`;
// วันที่ใบเสนอราคา: สลับครึ่งปีปัจจุบัน/ก่อนหน้า (i คู่=ปัจจุบัน · i คี่=ก่อนหน้า) → มีข้อมูลทั้งสองช่วงให้เทียบเทรนด์ได้จริง
const quoteDate = (r: () => number, i: number) =>
  i % 2 === 1 ? `${int(r, 1, 28)} ${pick(r, MO_PREV)} 2568` : `${int(r, 1, 28)} ${pick(r, MO)} 2569`;
const coName = (r: () => number) => `${pick(r, CO_PREFIX)} ${pick(r, CO_NAME)}`;

// สถานะ (ถ่วงน้ำหนักให้สมจริง)
const LEAD_STATUS_POOL: LeadStatus[] = [
  ..."WAITING".split("|").flatMap(() => Array(18).fill("WAITING")),
  ...Array(10).fill("BULLET"), ...Array(14).fill("QUOTED"), ...Array(16).fill("FOLLOWUP"),
  ...Array(10).fill("NEGO"), ...Array(20).fill("PAID"), ...Array(12).fill("CANCELLED"),
] as LeadStatus[];

// ── 48 ตัวแทน = 10 จริง + 38 สร้างเพิ่ม ──
function genDealers(): DealerRow[] {
  const r = rng(20260701);
  const extra: DealerRow[] = [];
  const usedCodes = new Set(dealerLeaderboard.map(d => d.code));
  for (let i = 0; extra.length < 38; i++) {
    const pv = PROVINCES[i % PROVINCES.length];
    const code = (pv.p.slice(0, 2).toUpperCase().replace(/[^A-Zก-๙]/g, "X") + String(i + 1)).slice(0, 5) + (i < 10 ? "0" : "") + i;
    const c = ("D" + String(100 + i)).slice(0, 5);
    if (usedCodes.has(c)) continue;
    usedCodes.add(c);
    const target = int(r, 20, 45) * 1_000_000;
    const actual = Math.round(target * (int(r, 25, 105) / 100));
    extra.push({
      id: c, code: c, name: `${pick(r, CO_PREFIX)} ${pv.p}สตีล`, region: pv.r,
      revenueActual: actual, revenueTarget: target, winRate: int(r, 22, 58),
      activeProjects: int(r, 1, 8), onTimePct: int(r, 60, 95),
      status: r() > 0.08 ? "active" : "inactive",
      credentials: { email: `sales${i}@dealer.co.th`, password: `PEB-${c}-${int(r, 1000, 9999)}` },
    });
  }
  return [...dealerLeaderboard, ...extra];
}
export const NET_DEALERS: DealerRow[] = genDealers();

// ── ~1,250 ลูกค้าเป้าหมายทั้งเครือ ──
function genLeads(): LeadRow[] {
  const r = rng(20260702);
  const out: LeadRow[] = [];
  for (let i = 0; i < 1250; i++) {
    const pv = pick(r, PROVINCES);
    const st = pick(r, LEAD_STATUS_POOL);
    const company = coName(r);
    const val = int(r, 5, 85) / 10; // 0.5–8.5M
    out.push({
      id: `#NL-${50000 + i}`, numId: 50000 + i, name: company, company,
      contact: `คุณ${pick(r, ["ก.", "ข.", "ค.", "ง.", "จ."])}`, province: pv.p,
      product: pick(r, PRODUCTS), category: pick(r, PRODUCTS), status: st,
      value: `฿${val.toFixed(1)}M`, assigned: pick(r, SALES), source: pick(r, SOURCES),
      createdAt: thaiDate(r), ...(st === "CANCELLED" ? { lostReason: pick(r, LOST_REASONS) } : {}),
    });
  }
  return out;
}
export const NET_LEADS: LeadRow[] = genLeads();

// ── ~820 ลูกค้าทั้งเครือ ──
function genCustomers(): HQCustomer[] {
  const r = rng(20260703);
  const out: HQCustomer[] = [];
  for (let i = 0; i < 890; i++) {
    const d = pick(r, NET_DEALERS); const pv = pick(r, PROVINCES);
    out.push({
      id: 20000 + i, name: coName(r), dealerCode: d.code, dealerName: d.name.replace("บจ. ", ""),
      type: pick(r, ["บริษัท", "หจก.", "บริษัท", "หน่วยงานรัฐ"]) as HQCustomer["type"],
      province: pv.p, dealsWon: int(r, 0, 4), totalRevenue: int(r, 8, 240) * 100_000,
      status: r() > 0.1 ? "active" : "inactive", lastContact: thaiDate(r),
      segment: pick(r, ["sme", "sme", "sme", "enterprise", "government"]) as HQCustomer["segment"],
    });
  }
  return out;
}
export const NET_CUSTOMERS: HQCustomer[] = genCustomers();

// ── ~670 ใบเสนอราคาทั้งเครือ (won ~286 · lost ~78 · ที่เหลือ draft/sent/viewed/expired) ──
const QUOTE_STATUS_POOL: QuotationStatus[] = [
  ...Array(43).fill("won"), ...Array(12).fill("lost"),
  ...Array(14).fill("draft"), ...Array(18).fill("sent_to_client"), ...Array(9).fill("viewed"), ...Array(4).fill("expired"),
] as QuotationStatus[];
function genQuotations(): HQQuotation[] {
  const r = rng(20260704);
  const out: HQQuotation[] = [];
  // ~1,340 ใบ = ครึ่งปีปัจจุบัน ~670 + ครึ่งปีก่อนหน้า ~670 (เพื่อให้ KPI ในช่วง ~670 และเทรนด์เทียบได้)
  for (let i = 0; i < 1340; i++) {
    const d = pick(r, NET_DEALERS); const st = pick(r, QUOTE_STATUS_POOL);
    out.push({
      id: `HQ-NQ${i}`, quoteNo: `Q-2026-${String(2000 + i)}`, dealerCode: d.code, dealerName: d.name.replace("บจ. ", ""),
      customer: coName(r), valueNum: int(r, 1, 6) * 100_000, discountPct: pick(r, [0, 0, 5, 5, 8, 10, 12]),
      status: st, createdAt: quoteDate(r, i), salesperson: pick(r, SALES), productLine: pick(r, PRODUCTS),
    });
  }
  return out;
}
export const NET_QUOTATIONS: HQQuotation[] = genQuotations();
