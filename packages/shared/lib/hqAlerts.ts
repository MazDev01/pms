// ─── การแจ้งเตือนของสำนักงานใหญ่ (คำนวณล้วน) ──────────────────────────────────
// แหล่งเดียวของ "กฎแจ้งเตือน 6 ข้อ" ที่ตั้งไว้ที่ /hq/settings → การแจ้งเตือน
// ทุกข้อคำนวณจากข้อมูลจริงเท่านั้น (ลีด/ใบเสนอราคา/เป้าตัวแทน) — ไม่มีตัวเลขสังเคราะห์
// ผลลัพธ์เป็นข้อมูลล้วน (ไม่มี JSX) → Topbar เอาไปใส่ไอคอนแล้วขึ้นกระดิ่ง
import {
  type HQAlertKey, type HQNotifRules, type LeadRules,
  type LeadRow, type DealerRow, type HQQuotation,
} from "@pms/shared/lib/mock";
import { parseDate, APP_NOW } from "@pms/shared/context/FilterContext";
import { leadCreatedDate, daysSinceContact, isLeadOpen } from "@pms/shared/lib/leadMetrics";

export type HQAlert = { key: HQAlertKey; title: string; body: string; href: string };

const DAY_MS = 86_400_000;
const fmtB = (n: number) => (n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : `฿${n.toLocaleString("th-TH")}`);

/** ลีดที่ยังไม่มีผู้รับผิดชอบ นานเกินเกณฑ์ของ "สาขาเจ้าของลีด" — นับจากวันที่สร้างลีด
 *  เกณฑ์ไม่ใช่ค่าเดียวทั้งเครืออีกแล้ว (ตัวแทนตั้งเอง) → ต้องถามเป็นรายใบด้วย dealerCode */
export function unassignedLeads(leads: LeadRow[], rulesOf: (dealerCode: string | undefined) => LeadRules): LeadRow[] {
  return leads.filter(l => {
    if (l.assigned?.trim()) return false;
    if (!isLeadOpen(l)) return false; // ปิดแล้วไม่ต้องหาคนรับผิดชอบ
    const hours = rulesOf(l.dealerCode).unassignedAlertHours;
    return (APP_NOW.getTime() - leadCreatedDate(l).getTime()) / 3_600_000 > hours;
  });
}

/** ลีดที่ยังไม่ปิด และไม่มีการติดต่อเกินเกณฑ์ (กฎ 7 วัน) */
export function idleLeads(leads: LeadRow[], days: number): LeadRow[] {
  return leads.filter(l => {
    if (!isLeadOpen(l)) return false;
    const d = daysSinceContact(l);
    return d !== null && d > days; // ไม่มีวันติดต่อบันทึกไว้ = ไม่เดาว่าค้าง
  });
}

/** ใบเสนอราคาที่ส่งแล้วและจะหมดอายุภายใน N วัน (วันหมดอายุ = วันที่ออก + อายุใบตามนโยบาย HQ) */
export function expiringQuotes(quotes: HQQuotation[], validityDays: number, withinDays: number) {
  const out: { q: HQQuotation; daysLeft: number }[] = [];
  for (const q of quotes) {
    if (q.status !== "sent_to_client") continue; // ค้างอยู่เท่านั้น — ตอบรับ/ปฏิเสธ/หมดอายุแล้วไม่ต้องเตือน
    const created = parseDate(q.createdAt);
    if (!created) continue;
    const daysLeft = Math.round((created.getTime() + validityDays * DAY_MS - APP_NOW.getTime()) / DAY_MS);
    if (daysLeft >= 0 && daysLeft <= withinDays) out.push({ q, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** ตัวแทนที่ไม่ออกใบเสนอราคาใหม่เกิน N วัน — ไม่เคยออกเลย = ไม่นับ (ไม่มีข้อมูลให้เทียบ) */
export function idleDealers(dealers: DealerRow[], quotes: HQQuotation[], days: number) {
  const latest = new Map<string, number>();
  for (const q of quotes) {
    const d = parseDate(q.createdAt);
    if (!d) continue;
    const prev = latest.get(q.dealerCode);
    if (prev == null || d.getTime() > prev) latest.set(q.dealerCode, d.getTime());
  }
  const out: { d: DealerRow; idleDays: number }[] = [];
  for (const d of dealers) {
    const last = latest.get(d.code);
    if (last == null) continue;
    const idleDays = Math.floor((APP_NOW.getTime() - last) / DAY_MS);
    if (idleDays > days) out.push({ d, idleDays });
  }
  return out.sort((a, b) => b.idleDays - a.idleDays);
}

/** ตัวแทนที่ทำยอดสะสมถึงสัดส่วนที่กำหนดของเป้าทั้งปี
 *  revenueOf = ยอดขายจริงของสาขา (จากใบที่ปิดการขายได้) — ห้ามอ่าน d.revenueActual
 *  เพราะคอลัมน์นั้นเป็นค่าเดโมที่ seed ไว้ จะทำให้เด้งแจ้งเตือน "ทำยอดถึงเป้า" ทั้งที่ยังไม่มียอดจริง */
export function dealersAtTarget(dealers: DealerRow[], pct: number, revenueOf: (code: string) => number) {
  return dealers
    .filter(d => d.revenueTarget > 0)
    .map(d => ({ d, actual: revenueOf(d.code), achieved: Math.round((revenueOf(d.code) / d.revenueTarget) * 100) }))
    .filter(x => x.achieved >= pct)
    .sort((a, b) => b.achieved - a.achieved);
}

/** อัตราปิดไม่สำเร็จของตัวแทน = ลีดที่ปิดไม่สำเร็จ ÷ ลีดที่ปิดแล้วทั้งหมด (ยังไม่ปิด = ไม่นับ)
 *  minClosed = กลุ่มตัวอย่างขั้นต่ำ — ตัวแทนที่ปิดลีดใบเดียวแล้วแพ้ได้ 100% ทันที ซึ่งไม่ได้แปลว่าแย่
 *  (ก่อนมีเกณฑ์นี้ กฎเด้ง 10 จาก 10 ตัวแทนด้วยข้อความ "1 จาก 1 ลีด" = เตือนทุกคนเท่ากับไม่เตือนใคร) */
export function dealersHighLostRate(dealers: DealerRow[], leads: LeadRow[], pct: number, minClosed: number) {
  const out: { d: DealerRow; rate: number; lost: number; closed: number }[] = [];
  for (const d of dealers) {
    const mine = leads.filter(l => l.dealerCode === d.code);
    const lost = mine.filter(l => l.status === "CANCELLED").length;
    const closed = lost + mine.filter(l => l.status === "PAID").length;
    if (closed < Math.max(1, minClosed)) continue; // ข้อมูลน้อยเกินกว่าจะสรุป
    const rate = Math.round((lost / closed) * 100);
    if (rate >= pct) out.push({ d, rate, lost, closed });
  }
  return out.sort((a, b) => b.rate - a.rate);
}

/** รวมการแจ้งเตือนทั้ง 6 ข้อตามกฎที่เปิดไว้ (เฉพาะข้อที่ inapp = ขึ้นกระดิ่ง) */
export function buildHQAlerts(input: {
  leads: LeadRow[];
  quotes: HQQuotation[];
  dealers: DealerRow[];
  rules: HQNotifRules;
  /** เกณฑ์รายสาขา — ตัวแทนแต่ละรายตั้งเอง จึงต้องถามด้วยรหัสสาขาของลีดใบนั้น */
  rulesOf: (dealerCode: string | undefined) => LeadRules;
  /** ยอดขายจริงรายสาขา (คำนวณจากใบที่ปิดได้) */
  revenueOf: (dealerCode: string) => number;
  validityDays: number;
}): HQAlert[] {
  const { leads, quotes, dealers, rules, rulesOf, validityDays } = input;
  const on = (k: HQAlertKey) => rules.alerts[k]?.on && rules.alerts[k]?.inapp;
  const out: HQAlert[] = [];

  if (on("unassignedLead")) {
    for (const l of unassignedLeads(leads, rulesOf)) {
      out.push({
        key: "unassignedLead",
        title: "ลูกค้าเป้าหมายยังไม่มีผู้รับผิดชอบ",
        body: `${l.company || l.name} · ${l.province} · ${l.value}`,
        href: `/hq/leads?open=${l.numId}`,
      });
    }
  }
  if (on("idleLead")) {
    // เกณฑ์ของ HQ (30 วัน) — คนละตัวกับกฎติดตามของแต่ละสาขาที่ตัวแทนตั้งเอง
    // ลีดเงียบ 8 วันเป็นงานของตัวแทน · ที่ HQ ต้องเห็นคือรายที่เงียบจนกลายเป็นเงินที่กำลังละลาย
    for (const l of idleLeads(leads, rules.leadIdleDays)) {
      out.push({
        key: "idleLead",
        title: "ลูกค้าเป้าหมายไม่มีการติดต่อ",
        body: `${l.company || l.name} · ไม่ได้ติดต่อ ${daysSinceContact(l)} วัน · ผู้รับผิดชอบ ${l.assigned || "—"}`,
        href: `/hq/leads?open=${l.numId}`,
      });
    }
  }
  if (on("quoteExpiring")) {
    for (const { q, daysLeft } of expiringQuotes(quotes, validityDays, rules.quoteExpiringDays)) {
      out.push({
        key: "quoteExpiring",
        title: "ใบเสนอราคาใกล้หมดอายุ",
        body: `${q.quoteNo} · ${q.customer} · ${fmtB(q.valueNum)} · เหลือ ${daysLeft} วัน`,
        href: "/hq/quotations",
      });
    }
  }
  if (on("dealerIdle")) {
    for (const { d, idleDays } of idleDealers(dealers, quotes, rules.dealerIdleDays)) {
      out.push({
        key: "dealerIdle",
        title: "ตัวแทนไม่มีความเคลื่อนไหว",
        body: `${d.code} · ${d.name} — ไม่ออกใบเสนอราคาใหม่ ${idleDays} วัน`,
        href: `/hq/dealers/${d.code}`,
      });
    }
  }
  if (on("targetAchieved")) {
    for (const { d, actual, achieved } of dealersAtTarget(dealers, rules.targetAchievedPct, input.revenueOf)) {
      out.push({
        key: "targetAchieved",
        title: "ตัวแทนทำยอดถึงเป้า",
        body: `${d.code} · ${d.name} — ทำได้ ${achieved}% ของเป้า (${fmtB(actual)} จาก ${fmtB(d.revenueTarget)})`,
        href: `/hq/dealers/${d.code}`,
      });
    }
  }
  if (on("lostRate")) {
    for (const { d, rate, lost, closed } of dealersHighLostRate(dealers, leads, rules.lostRatePct, rules.lostRateMinClosed)) {
      out.push({
        key: "lostRate",
        title: "อัตราปิดการขายไม่สำเร็จสูง",
        body: `${d.code} · ${d.name} — ปิดไม่สำเร็จ ${rate}% (${lost} จาก ${closed} ลีดที่ปิดแล้ว)`,
        href: `/hq/dealers/${d.code}`,
      });
    }
  }
  return out;
}
