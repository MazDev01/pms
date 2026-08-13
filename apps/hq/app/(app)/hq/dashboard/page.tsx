"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy, Building2,
  FileText, ChevronRight, Users2,
  Target, Info,
} from "lucide-react";
import { PlanVsActualBars, GroupedBarChart, Donut, ProgressRing, CategoryRows } from "@pms/shared/components/ui/Charts";
import { ActivityTimeline, type ActivityTimelineItem } from "@pms/shared/components/ui/ActivityTimeline";
import {
  MonthRangeToggle, lastNMonths, monthRangeSubtitle, monthKeyOf, monthKey,
  type MonthRange,
} from "@pms/shared/components/ui/MonthRangeToggle";
import {
  DEFAULT_HQ_TARGETS, hqAuditCategory,
  DEFAULT_DEALER_CODE,
  type DealerRow, type HQTargets,
} from "@pms/shared/lib/mock";
import { useRepoValue } from "@pms/shared/lib/useRepoState";
import { dealers as dealersRepo, settings as settingsRepo } from "@pms/shared/lib/data";
import { useFilters, APP_NOW } from "@pms/shared/context/FilterContext";
import { FilterBar, SelectFilter } from "@pms/shared/components/filters/FilterBar";
import { SalesTrendChart } from "@pms/shared/components/ui/SalesTrendChart";
import { useNetworkQuotations, useNetworkCustomers, useNetworkLeads, useNetworkQuoteRange, useDashboardQuoteSummary, useLeadSummary, useNetworkCustomerSummary } from "@pms/shared/lib/useNetworkData";
import { useDealerPerformance } from "@pms/shared/lib/useDealerPerformance";
import { regionDisplay } from "@pms/shared/lib/hqQuotations";

import { useSales } from "@pms/shared/context/SalesContext";
import { useAuditEntries } from "@pms/shared/lib/useAudit";
import { fmtBaht, parseBaht } from "@pms/shared/lib/format";

const PRIMARY = "#003366";
// palette หลายสีสำหรับกราฟรายภาค/แม่แบบ — navy หลัก + สีเสริม (ไม่ฉูดฉาด)
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
// ลีดทั้งเครือทุกช่วง (ตัวกรองว่าง) — อ้างอิงคงที่ กัน useLeadSummary รีเฟตช์ทุกเรนเดอร์
const EMPTY_LEAD_FILTER = {};
const TH_MONTH: Record<string, number> = { "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5, "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11 };
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(s.trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const addDaysD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// regionDisplay = ใช้ของกลาง (hqQuotations.ts) แหล่งเดียว — เดิม copy ในไฟล์นี้ไม่มี guard "ไม่ระบุ" (1.4)
//
// เคยมีชุดข้อมูลสำหรับ "แผนที่ความครอบคลุมรายภูมิภาค" อยู่ตรงนี้ (tierColor / TIER_LEGEND /
// THAI_REGION_PATHS / DEALER_PROVINCE) แต่ไม่มีที่ไหนเรียกใช้แล้ว — ตัวแผนที่เองก็ไม่ได้ถูกวางบนหน้า
// ลบออกพร้อมกัน (ตรวจสอบระบบ 5 ส.ค. 69) · ถ้าจะทำแผนที่อีกครั้ง ควรทำเป็นคอมโพเนนต์กลางใน
// @pms/shared/components/ui/Charts เพื่อให้หน้าอื่นใช้ร่วมได้ ไม่ใช่เขียนซ้ำในหน้าเดียว

export default function HQDashboard() {
  const router = useRouter();
  const { timeRange } = useFilters();
  // ข้อมูลตัวแทน = ชุดเดียวกับหน้า "ตัวแทน" (persist ผ่าน HQ_DEALERS_KEY) — คุณสมบัติคงที่ (ชื่อ/ภาค/เป้าทั้งปี/สถานะ)
  const allDealers = useRepoValue<DealerRow[]>(() => dealersRepo.list(), []);
  // เป้าหมายที่ HQ ตั้งไว้ (แหล่งเดียว) — ใช้เป็นเกณฑ์สี Win rate แทนการ hardcode
  const targets = useRepoValue<HQTargets>(() => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);
  // เกณฑ์การแจ้งเตือน (ตั้งที่ /hq/settings → การแจ้งเตือน) — อ่านหลัง mount กัน hydration mismatch
  // notifRules ถูกลบพร้อมการ์ดแจ้งเตือน — เกณฑ์เตือนไม่มีใครอ่านแล้ว
  // ตัวเลือกตัวแทนเฉพาะหน้านี้ (แต่ละหน้า HQ เลือกแยกกัน ไม่จำข้ามหน้า)
  const [dealerSel, setDealerSel] = useState<string>("all");
  const dealers = useMemo(
    () => dealerSel === "all" ? allDealers : allDealers.filter(d => d.code === dealerSel),
    [allDealers, dealerSel],
  );
  const selDealer = dealerSel === "all" ? null : dealers[0] ?? null;

  // จำนวนวันของช่วงที่เลือก (ใช้คิดเป้าตามสัดส่วน + หน้าต่างเทียบก่อนหน้า)
  const periodDays = Math.max(1, Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / 86_400_000) + 1);

  const netQuotes = useNetworkQuotations(); // ใบที่ดีลเลอร์สร้างจริง + seed เครือ (แหล่งเดียว)
  const netCustomers = useNetworkCustomers();
  const allNetLeads = useNetworkLeads();
  // aggregate ใบในช่วง/ช่วงก่อนหน้า ที่ DB (M9 · supabase เท่านั้น · local = null → ใช้ winQuotes ฝั่ง client)
  // ป้อน Scorecard (ผลรวม) + dealerStats — parity กับ winQuotes เป๊ะ จึงตรงกับการ์ดอื่นที่ยังใช้ winQuotes
  const curRange = useNetworkQuoteRange(timeRange.start, timeRange.end, selDealer?.code);
  const prevRange = useNetworkQuoteRange(addDaysD(timeRange.start, -periodDays), addDaysD(timeRange.start, -1), selDealer?.code);
  // สรุปใบในช่วง (byStatus/byProduct/byMonth) ที่ DB — ป้อน productAgg/buildingPerf/quoteStatus/pipeline/wonVal
  const quoteSummary = useDashboardQuoteSummary(timeRange.start, timeRange.end, selDealer?.code);
  // สรุปลีด + ลูกค้าทั้งเครือ ที่ DB · ผูกตัวแทนที่เลือก (selDealer) ให้ตรงกับฝั่งใบเสนอราคา (M3)
  //   เดิมไม่ผูก selDealer → พอเลือกสาขา กราฟ/KPI ลีดยังโชว์ทั้งเครือ แต่ใบ/ยอดโชว์เฉพาะสาขา = ขัดกันในการ์ดเดียว
  //   ปลด journeyStages/leadQuoteSeries/monthly/bottomMetrics/barTrend/provinceTop6 ออกจาก array (M9 Phase 4)
  //   null (local/ยังไม่โหลด) → useMemo แต่ละใบ fallback คำนวณจาก allNetLeads/netCustomers เดิม
  const dashLeadSum = useLeadSummary(selDealer ? { dealerCodes: [selDealer.code] } : EMPTY_LEAD_FILTER);
  const custSummary = useNetworkCustomerSummary();
  // ลีดรายเดือนปฏิทิน (index 0..11, รวมทุกปี ให้ตรง getMonth ฝั่ง client) + จำนวนลีดรวม จาก lead_summary
  const leadCal = useMemo(() => {
    if (!dashLeadSum) return null;
    const m = Array(12).fill(0);
    for (const r of dashLeadSum.byMonth) m[r.m] += r.created;
    return m;
  }, [dashLeadSum]);
  const leadTotal = useMemo(
    () => dashLeadSum ? dashLeadSum.byStatus.reduce((s, r) => s + r.count, 0) : null,
    [dashLeadSum],
  );
  const { appointments } = useSales();
  const totalDealers = allDealers.length;
  // ใบเสนอราคาของตัวแทนที่เลือก — ยังไม่ตัดตามช่วงเวลา
  // กราฟแนวโน้ม (เส้น/แท่ง) ใช้ชุดนี้ เพราะมีปุ่มช่วงย้อนหลังของตัวเอง ต้องมองข้ามตัวกรองเวลาบนแถบบนได้
  const scopedQuotes = useMemo(
    () => selDealer ? netQuotes.filter(q => q.dealerCode === selDealer.code) : netQuotes,
    [netQuotes, selDealer],
  );

  // ── ใบเสนอราคาในช่วงเวลาที่เลือก (แหล่งข้อมูลของ KPI/ตาราง/การ์ดอื่นทั้งหน้า) + หน้าต่างก่อนหน้าสำหรับ trend ──
  const { winQuotes, prevQuotes } = useMemo(() => {
    const s = timeRange.start, e = timeRange.end;
    const ps = addDaysD(s, -periodDays), pe = addDaysD(s, -1);
    const inR = (createdAt: string, a: Date, b: Date) => { const d = parseThaiDate(createdAt); return !!d && d >= a && d <= b; };
    return {
      winQuotes: scopedQuotes.filter(q => inR(q.createdAt, s, e)),
      prevQuotes: scopedQuotes.filter(q => inR(q.createdAt, ps, pe)),
    };
  }, [scopedQuotes, timeRange.start, timeRange.end, periodDays]);

  // ── ชุดสรุปใบในช่วง (สถานะ/แม่แบบ/รายเดือน) — supabase: จาก RPC dashboard_quote_summary · local/ยังไม่กลับ: จาก winQuotes ──
  // parity เดียวกันจึงให้ผลตรงกับการ์ดที่ยังใช้ winQuotes · ประกาศก่อน consumer ทุกตัว (trendMonthly ใช้ตั้งแต่ต้น)
  const statusAgg = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    if (quoteSummary) { for (const r of quoteSummary.byStatus) m.set(r.status, { count: r.count, value: r.value }); return m; }
    winQuotes.forEach(q => { const r = m.get(q.status) ?? { count: 0, value: 0 }; r.count += 1; r.value += q.valueNum; m.set(q.status, r); });
    return m;
  }, [quoteSummary, winQuotes]);
  // ⚠️ การ์ดนี้ชื่อ "ยอดขายตามประเภทอาคาร" → ต้องนับเฉพาะใบที่ปิดการขายได้ (แก้ 10 ส.ค. 69)
  //   เดิมฝั่ง DB ส่ง value = ยอดรวมทุกใบ (รวมร่าง/ที่ปิดไม่สำเร็จ) → การ์ดขึ้น ฿15.6M
  //   ขณะที่การ์ดอื่นในหน้าเดียวกันขึ้น ฿10.2M · ฝั่ง local คิดจากใบที่ชนะอยู่แล้วมาแต่แรก
  //   = ทางที่ถูกคือใบที่ชนะ · ตอนนี้ DB ส่ง wonValue/wonProjects มาให้แล้ว (migration 0132)
  const productArr = useMemo(() => {
    if (quoteSummary) return quoteSummary.byProduct.map(r => ({
      product: (r.product ?? undefined) as string,
      value: r.wonValue ?? r.value,
      projects: r.wonProjects ?? r.projects,
    }));
    const m = new Map<string, { value: number; projects: number }>();
    winQuotes.forEach(q => { const r = m.get(q.productLine) ?? { value: 0, projects: 0 }; r.value += q.valueNum; r.projects += 1; m.set(q.productLine, r); });
    return [...m.entries()].map(([product, v]) => ({ product, ...v })).sort((a, b) => b.value - a.value);
  }, [quoteSummary, winQuotes]);
  // byMonth ราย (ปี,เดือน) — supabase: จาก RPC · local/ยังไม่กลับ: จาก winQuotes (parity เดียวกัน)
  const monthAgg = useMemo(() => {
    if (quoteSummary) return quoteSummary.byMonth;
    const map = new Map<string, { y: number; m: number; quotes: number; won: number; lost: number; wonVal: number }>();
    winQuotes.forEach(q => {
      const d = parseThaiDate(q.createdAt); if (!d) return;
      const y = d.getFullYear(), m = d.getMonth(), key = `${y}-${m}`;
      let r = map.get(key); if (!r) { r = { y, m, quotes: 0, won: 0, lost: 0, wonVal: 0 }; map.set(key, r); }
      r.quotes += 1; if (q.status === "won") { r.won += 1; r.wonVal += q.valueNum; } if (q.status === "lost") r.lost += 1;
    });
    return [...map.values()];
  }, [quoteSummary, winQuotes]);
  // ยุบเป็นรายเดือนปฏิทิน 0-11 (รวมข้ามปีในช่วง) สำหรับ series/sparkline/bottomMetrics
  const monthCal = useMemo(() => {
    const quotes = Array(12).fill(0), won = Array(12).fill(0), lost = Array(12).fill(0), wonVal = Array(12).fill(0);
    for (const r of monthAgg) { quotes[r.m] += r.quotes; won[r.m] += r.won; lost[r.m] += r.lost; wonVal[r.m] += r.wonVal; }
    return { quotes, won, lost, wonVal };
  }, [monthAgg]);

  // ── Scorecard — คำนวณจากใบเสนอราคาในช่วง · trend = เทียบช่วงก่อนหน้าเท่ากัน ──
  const sc = useMemo(() => {
    const statsOf = (arr: typeof winQuotes) => {
      const won = arr.filter(q => q.status === "won");
      const lost = arr.filter(q => q.status === "lost");
      const closed = won.length + lost.length;
      return {
        quotes: arr.length, quoteVal: arr.reduce((s, q) => s + q.valueNum, 0),
        won: won.length, wonVal: won.reduce((s, q) => s + q.valueNum, 0),
        lost: lost.length, conv: closed ? Math.round((won.length / closed) * 100) : 0,
      };
    };
    // supabase: รวมจาก rollup ช่วงที่ DB (parity) · local/ยังไม่กลับ: คำนวณจาก winQuotes เดิม
    const sumRange = (rng: typeof curRange, client: typeof winQuotes) => {
      if (!rng) return statsOf(client);
      let quotes = 0, quoteVal = 0, won = 0, wonVal = 0, lost = 0;
      for (const r of rng.values()) { quotes += r.quotes; quoteVal += r.quoteVal; won += r.won; wonVal += r.wonVal; lost += r.lost; }
      const closed = won + lost;
      return { quotes, quoteVal, won, wonVal, lost, conv: closed ? Math.round((won / closed) * 100) : 0 };
    };
    const cur = sumRange(curRange, winQuotes), prev = sumRange(prevRange, prevQuotes);
    const pctf = (c: number, p: number) => p > 0 ? Math.round(((c - p) / p) * 100) : (c > 0 ? 100 : 0);
    return {
      dealers:   { value: `${totalDealers}`, trend: 0 },
      leads:     { value: `${leadTotal ?? allNetLeads.length}`, trend: 0 },
      customers: { value: `${custSummary?.total ?? netCustomers.length}`, trend: 0 },
      quotes:    { value: `${cur.quotes}`, trend: pctf(cur.quotes, prev.quotes) },
      wonVal:    { value: fmtBaht(cur.wonVal), trend: pctf(cur.wonVal, prev.wonVal) },
      won:       { value: `${cur.won}`, trend: pctf(cur.won, prev.won) },
      lost:      { value: `${cur.lost}`, trend: pctf(cur.lost, prev.lost) },
      conv:      { value: `${cur.conv}%`, trend: pctf(cur.conv, prev.conv) },
    };
  }, [winQuotes, prevQuotes, curRange, prevRange, totalDealers, leadTotal, allNetLeads.length, custSummary?.total, netCustomers.length]);

  // ── สถิติรายตัวแทนในช่วง — คำนวณจากใบเสนอราคาจริง (รายได้=มูลค่า won · อัตราปิด=won/(won+lost)) ──
  const dealerStats = useMemo(() => {
    const m = new Map<string, { revenue: number; total: number; won: number; lost: number }>();
    // supabase: มาจาก rollup ช่วงที่ DB (parity) · local/ยังไม่กลับ: คำนวณจาก winQuotes เดิม
    if (curRange) {
      for (const [code, r] of curRange) m.set(code, { revenue: r.wonVal, total: r.quotes, won: r.won, lost: r.lost });
      return m;
    }
    winQuotes.forEach(q => {
      const r = m.get(q.dealerCode) ?? { revenue: 0, total: 0, won: 0, lost: 0 };
      r.total += 1;
      if (q.status === "won") { r.won += 1; r.revenue += q.valueNum; }
      if (q.status === "lost") r.lost += 1;
      m.set(q.dealerCode, r);
    });
    return m;
  }, [winQuotes, curRange]);

  // ยอดขายสะสมทั้งปีจริง รายตัวแทน — สำหรับ "% เป้า" (เป้าเป็นรายปี ห้ามเทียบกับยอดแค่ในช่วงตัวกรอง)
  // มาจาก rollup กลาง (useDealerPerformance.revenue = Σ มูลค่า won ปีนี้ รายสาขา) — supabase คิดที่ DB (M9)
  // scope selDealer: มีตัวแทนที่เลือก = คงเฉพาะสาขานั้น (เท่าพฤติกรรมเดิมที่กรองผ่าน scopedQuotes)
  const dealerPerf = useDealerPerformance();
  const annualWonByDealer = useMemo(() => {
    const m = new Map<string, number>();
    for (const [code, p] of dealerPerf) {
      if (selDealer && code !== selDealer.code) continue;
      m.set(code, p.revenue);
    }
    return m;
  }, [dealerPerf, selDealer]);

  // อันดับตัวแทน — ทุกคอลัมน์คำนวณจากใบเสนอราคาจริง (บอสสั่ง 17 ก.ค. 69: "ให้แสดงค่าข้อมูลจริง")
  // เดิมใช้ค่าซีดตายตัวของ DealerRow (revenueActual/winRate) → ตัวเลขไม่ขยับตามช่วงเวลา
  // และไม่ตรงกับหน้าอื่นที่คำนวณจริง (CNX ฿22.4M ที่นี่ vs ฿24.6M ที่ pipeline/leads/quotations)
  //   ยอดขาย  = มูลค่าใบที่ปิดได้ "ในช่วงที่เลือก" (แหล่งเดียวกับ KPI ของหน้านี้)
  //   อัตราปิด = ปิดได้ ÷ (ปิดได้+ปิดไม่ได้) นิยามกลางของระบบ · ไม่มีใบรู้ผล = "—" ไม่ใช่ 0%
  //   % เป้า   = ยอดปิดได้สะสมทั้งปีจริง ÷ เป้าทั้งปี (เป้าเป็นรายปี — ไม่หดตามตัวกรองเวลา)
  const rankedWin = useMemo(() => dealers.map(d => {
    const st = dealerStats.get(d.code) ?? { revenue: 0, total: 0, won: 0, lost: 0 };
    const closed = st.won + st.lost;
    const annual = annualWonByDealer.get(d.code) ?? 0;
    const tpct = d.revenueTarget > 0 ? Math.round((annual / d.revenueTarget) * 100) : 0;
    return {
      ...d, revenueW: st.revenue, quotesW: st.total, wonW: st.won, tpct,
      convW: closed ? Math.round((st.won / closed) * 100) : null,
    };
  }).sort((a, b) => b.revenueW - a.revenueW), [dealers, dealerStats, annualWonByDealer]);
  const best = rankedWin[0];

  // ยอดขายรายเดือนในช่วง (ล้านบาท) ป้อนกราฟแนวโน้ม — สรุปจาก won ในช่วงที่เลือก
  const trendMonthly = useMemo(() => {
    // bucket ด้วย key "ปี-เดือน" (ข้ามปีไม่พัง) → ยอด won ต่อเดือน · byKey = wonVal ต่อ (ปี,เดือน)
    const byKey = new Map<string, number>();
    for (const r of monthAgg) byKey.set(`${r.y}-${r.m}`, (byKey.get(`${r.y}-${r.m}`) ?? 0) + r.wonVal);
    const pts: { month: string; value: number }[] = [];
    const cur = new Date(timeRange.start.getFullYear(), timeRange.start.getMonth(), 1);
    const end = new Date(timeRange.end.getFullYear(), timeRange.end.getMonth(), 1);
    while (cur <= end) {
      pts.push({ month: TH_ABBR[cur.getMonth()], value: Math.round((byKey.get(`${cur.getFullYear()}-${cur.getMonth()}`) ?? 0) / 1e6 * 10) / 10 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return pts.length ? pts : [{ month: TH_ABBR[timeRange.end.getMonth()], value: 0 }];
  }, [monthAgg, timeRange.start, timeRange.end]);
  const trendTitle = selDealer ? `ยอดขาย ${selDealer.name.replace("Benjamin ", "")} รายเดือน` : "ยอดขายรวมทั้งเครือ รายเดือน";
  const trendDesc = selDealer ? `เฉพาะตัวแทน ${selDealer.code} (ล้านบาท)` : "มูลค่าที่ปิดได้ทุกตัวแทนรวมกัน (ล้านบาท)";

  // ผลงานรายภาค — count = จำนวนตัวแทน (โดนัท) · revenue = ยอดขาย "ทั้งปีจริง" (annualWonByDealer)
  // ต้องใช้ยอดทั้งปี ไม่ใช่ revenueW (ในช่วงตัวกรอง) เพราะการ์ดนี้กำกับ "ไม่ขึ้นกับตัวกรองช่วงเวลา"
  // และแถบข้างล่างติดป้าย "ยอดสะสมทั้งปี" — ถ้าใช้ revenueW จะหดตามตัวกรอง ขัดกับป้ายตัวเอง
  const regions = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    rankedWin.forEach(d => {
      const r = m.get(d.region) ?? { revenue: 0, count: 0 };
      r.revenue += annualWonByDealer.get(d.code) ?? 0; r.count += 1;
      m.set(d.region, r);
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v })).sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(...arr.map(a => a.revenue), 1);
    return arr.map(a => ({ ...a, pct: Math.round((a.revenue / max) * 100) }));
  }, [rankedWin, annualWonByDealer]);

  // สัดส่วนมูลค่าตามแม่แบบ (มูลค่าใบเสนอราคาในช่วง แยกตาม productLine)
  const productAgg = useMemo(
    () => productArr.map((p, i) => ({ product: p.product, valueNum: p.value, color: RAMP[i % RAMP.length] })),
    [productArr],
  );

  // ── ใบเสนอราคา เทียบ ปิดการขาย (รายเดือน) + การวิเคราะห์การแปลง (Funnel เป็นแถบ) ──
  const quoteWonSeries = useMemo(() => ({ qC: monthCal.quotes, wC: monthCal.won }), [monthCal]);
  // ── Sales Journey Pipeline — การ์ดขั้นตอนแนวนอน (ไม่ใช่ funnel/กรวย) ──
  const journeyStages = useMemo(() => {
    const rank: Record<string, number> = { WAITING: 1, BULLET: 2, QUOTED: 3, FOLLOWUP: 3, NEGO: 4, PAID: 5 };
    const rk = (s: string) => rank[s] ?? 0;
    const defs = [
      { label: "ลูกค้าเป้าหมาย", r: 0 },
      { label: "ติดต่อแล้ว", r: 1 },
      { label: "รวบรวมความต้องการ", r: 2 },
      { label: "เสนอราคา", r: 3 },
      { label: "เจรจาต่อรอง", r: 4 },
      { label: "ปิดการขาย", r: 5 },
    ];
    // supabase: cumulative จาก byStatus (count + value=Σ parse_baht) ที่ DB · local/ยังไม่กลับ: จาก array เดิม
    if (dashLeadSum) {
      const total = dashLeadSum.byStatus.reduce((s, r) => s + r.count, 0);
      return defs.map(d => {
        const rows = dashLeadSum.byStatus.filter(r => rk(r.status) >= d.r); // r=0 → รวมทุกสถานะ (rk>=0 เสมอ)
        const count = rows.reduce((s, r) => s + r.count, 0);
        return { label: d.label, count, pct: total ? Math.round((count / total) * 100) : 0, value: rows.reduce((s, r) => s + r.value, 0) };
      });
    }
    const total = allNetLeads.length;
    return defs.map(d => {
      const arr = d.r === 0 ? allNetLeads : allNetLeads.filter(l => rk(l.status) >= d.r);
      return {
        label: d.label,
        count: arr.length,
        pct: total ? Math.round((arr.length / total) * 100) : 0,
        value: arr.reduce((s, l) => s + parseBaht(l.value), 0),
      };
    });
  }, [dashLeadSum, allNetLeads]);

  // ── Lead vs Quotation (รายเดือน) — นับทุกใบทั้งเครือ ทุกช่วง แยกตามเดือนปฏิทิน ──
  // qC จาก summary ทั้งเครือทุกช่วง (dealer=undefined) — supabase · local/ยังไม่กลับ = netQuotes เดิม
  const allQuoteSummary = useDashboardQuoteSummary(new Date(1970, 0, 1), new Date(2999, 11, 31), undefined);
  const leadQuoteSeries = useMemo(() => {
    const lC = Array(12).fill(0), qC = Array(12).fill(0);
    if (leadCal) { for (let i = 0; i < 12; i++) lC[i] = leadCal[i]; }        // supabase: lead_summary.byMonth
    else allNetLeads.forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (d) lC[d.getMonth()]++; });
    if (allQuoteSummary) { for (const r of allQuoteSummary.byMonth) qC[r.m] += r.quotes; }
    else netQuotes.forEach(q => { const d = parseThaiDate(q.createdAt); if (d) qC[d.getMonth()]++; });
    return { lC, qC };
  }, [leadCal, allNetLeads, allQuoteSummary, netQuotes]);

  // ── สถานะใบเสนอราคา (กราฟแท่ง) — สีตามสเปค: ร่าง เทา · ส่ง navy · ตอบรับ เขียว · ปฏิเสธ แดง · หมดอายุ ส้ม ──
  const quoteStatus = useMemo(() => {
    const order = [
      { k: "draft",          label: "ร่าง",     color: "#9ca3af" },
      { k: "sent_to_client", label: "ส่งแล้ว",   color: "#003366" },
      { k: "won",            label: "ตอบรับ",   color: "#059669" },
      { k: "lost",           label: "ปฏิเสธ",   color: "#dc2626" },
      { k: "expired",        label: "หมดอายุ",  color: "#d97706" },
    ];
    return order.map(o => ({ ...o, count: statusAgg.get(o.k)?.count ?? 0 }));
  }, [statusAgg]);

  // ── ยอดขายตามประเภทอาคาร (Top 5) + % ──
  const templateTotal = useMemo(() => productAgg.reduce((s, p) => s + p.valueNum, 0), [productAgg]);
  const templateTop = useMemo(() => productAgg.slice(0, 5).map(p => ({ ...p, pct: templateTotal ? Math.round(p.valueNum / templateTotal * 100) : 0 })), [productAgg, templateTotal]);

  // ตัวคำนวณ alerts ถูกลบพร้อมการ์ดแจ้งเตือน — ไม่มีใครอ่านผลแล้ว

  // ── ชุดข้อมูลรายเดือนสำหรับ sparkline บนการ์ด KPI ──
  const monthly = useMemo(() => {
    const mo = (s: string) => { const d = parseThaiDate(s); return d ? d.getMonth() : -1; };
    const leadsM = Array(12).fill(0); // ใบมาจาก monthCal (DB) · ลีด: supabase=leadCal(DB) · local/ยังไม่กลับ=array
    if (leadCal) { for (let i = 0; i < 12; i++) leadsM[i] = leadCal[i]; }
    else allNetLeads.forEach(l => { const m = mo(l.createdAt ?? ""); if (m >= 0) leadsM[m]++; });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    const slice = (arr: number[]) => arr.slice(a, b + 1);
    const convM = monthCal.won.map((w, i) => (w + monthCal.lost[i]) ? Math.round(w / (w + monthCal.lost[i]) * 100) : 0);
    return { sales: slice(monthCal.wonVal.map(v => v / 1e6)), quotes: slice(monthCal.quotes), customers: slice(leadsM), won: slice(monthCal.won), lost: slice(monthCal.lost), conv: slice(convM) };
  }, [monthCal, leadCal, allNetLeads, timeRange]);

  // ยอดขายตามจังหวัด (Top 6) — จากลูกค้าในเครือ · supabase: network_customer_summary.byProvince · local: array
  const provinceTop6 = useMemo(() => {
    const arr = custSummary
      ? custSummary.byProvince.map(p => ({ province: p.province, value: p.revenue }))
      : (() => {
          const m = new Map<string, number>();
          netCustomers.forEach(c => m.set(c.province, (m.get(c.province) ?? 0) + (c.totalRevenue || 0)));
          return [...m.entries()].map(([province, value]) => ({ province, value }));
        })();
    arr.sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map(a => a.value), 1);
    return arr.slice(0, 6).map(p => ({ ...p, pct: Math.round(p.value / max * 100) }));
  }, [custSummary, netCustomers]);

  // สถานะ Pipeline โดยรวม — จำนวน + มูลค่า ต่อสถานะ (แถบแนวนอน)
  const pipeline = useMemo(() => {
    const defs = [
      { k: "draft",          label: "ร่าง",     color: "#9ca3af" },
      { k: "sent_to_client", label: "ส่งแล้ว",   color: "#003366" },
      { k: "won",            label: "ตอบรับ",   color: "#059669" },
      { k: "lost",           label: "ปฏิเสธ",   color: "#dc2626" },
      { k: "expired",        label: "หมดอายุ",  color: "#d97706" },
    ];
    const rows = defs.map(d => { const s = statusAgg.get(d.k) ?? { count: 0, value: 0 }; return { ...d, count: s.count, value: s.value }; });
    const maxV = Math.max(...rows.map(r => r.value), 1);
    return { rows: rows.map(r => ({ ...r, pct: Math.round(r.value / maxV * 100) })), totalC: rows.reduce((s, r) => s + r.count, 0), totalV: rows.reduce((s, r) => s + r.value, 0) };
  }, [statusAgg]);

  // แถบล่าง — ตัวชี้วัดรอง (เดือนล่าสุดในช่วง + เทียบเดือนก่อนหน้า)
  const bottomMetrics = useMemo(() => {
    const lm = timeRange.end.getMonth();
    const cnt = (arr: string[], m: number) => arr.filter(s => { const d = parseThaiDate(s); return d && d.getMonth() === m; }).length;
    const at = (arr: number[], m: number) => (m >= 0 && m < 12) ? arr[m] : 0; // ส่วนใบจาก monthCal (DB)
    const leadDates = leadCal ? null : allNetLeads.map(l => l.createdAt ?? ""); // supabase ใช้ leadCal แทน
    const wonThis = at(monthCal.won, lm), wonPrev = at(monthCal.won, lm - 1);
    const totalWon = monthCal.won.reduce((s, x) => s + x, 0);
    const wonValTotal = statusAgg.get("won")?.value ?? 0; // = Σ wonVal ในช่วง → avgDeal = ยอดรวม ÷ จำนวน won
    const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? 100 : 0);
    const nl  = leadCal ? at(leadCal, lm)     : cnt(leadDates!, lm);
    const nlP = leadCal ? at(leadCal, lm - 1) : cnt(leadDates!, lm - 1);
    const nq = at(monthCal.quotes, lm), nqP = at(monthCal.quotes, lm - 1);
    return {
      totalLeads: leadTotal ?? allNetLeads.length,
      newLeads: nl, newLeadsTrend: pct(nl, nlP),
      newCustomers: wonThis, newCustomersTrend: pct(wonThis, wonPrev),
      newQuotes: nq, newQuotesTrend: pct(nq, nqP),
      avgDeal: totalWon ? Math.round(wonValTotal / totalWon) : 0,
      cycleDays: 28,
    };
  }, [leadCal, leadTotal, allNetLeads, monthCal, statusAgg, timeRange]);

  // ── เป้าหมายทั้งเครือ + Achievement ──
  const wonValNum = useMemo(() => statusAgg.get("won")?.value ?? 0, [statusAgg]);
  const goalPeriod = Math.round(targets.annualTarget * periodDays / 365) || 1;
  const achievementPct = Math.round(wonValNum / goalPeriod * 100);
  // ยอดปิดได้สะสม "ทั้งปีนี้" (ไม่ขึ้นกับตัวกรองเวลา) — ใช้กับการ์ดเป้าหมายทั้งปี/วงแหวน % เป้า
  // กฎระบบ: เป้าเป็นรายปี ห้ามเทียบกับยอดแค่ในช่วงตัวกรอง (ตารางอันดับตัวแทนใช้หลักเดียวกัน — annualWonByDealer)
  const annualWonTotal = useMemo(() => { let s = 0; annualWonByDealer.forEach(v => (s += v)); return s; }, [annualWonByDealer]);

  // ประเภทอาคาร + จำนวนโครงการ
  const buildingPerf = useMemo(() => {
    const max = Math.max(...productArr.map(a => a.value), 1);
    return productArr.slice(0, 5).map((p, i) => ({ product: p.product, value: p.value, projects: p.projects, pct: Math.round(p.value / max * 100), color: RAMP[i % RAMP.length] }));
  }, [productArr]);

  // ── กราฟแท่ง "ลีด · ใบเสนอราคา · ปิดการขาย (รายเดือน)" — ปุ่มช่วงย้อนหลังของตัวเอง ──
  // ไม่ผูกกับตัวกรองเวลาบนแถบบน (เป็นกราฟแนวโน้ม ต้องเห็นย้อนหลังเสมอ · กติกาเดียวกับแดชบอร์ดตัวแทน)
  // ถังเดือนใช้คีย์ YYYY-MM — ช่วง 12 เดือนคาบเกี่ยว 2 ปี ถ้านับแต่เลขเดือนยอดปีที่แล้วจะทับปีนี้
  const [barRange, setBarRange] = useState<MonthRange>(6);
  // สรุปใบในหน้าต่าง barRange ที่ DB (byMonth) — supabase · local/ยังไม่กลับ = scopedQuotes เดิม
  const barSummary = useDashboardQuoteSummary(
    new Date(APP_NOW.getFullYear(), APP_NOW.getMonth() - (barRange - 1), 1),
    new Date(APP_NOW.getFullYear(), APP_NOW.getMonth() + 1, 0), selDealer?.code);
  const barTrend = useMemo(() => {
    const buckets = lastNMonths(barRange, APP_NOW);
    const leadsM = new Map<string, number>(), quotesM = new Map<string, number>(), wonM = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    if (barSummary) { for (const r of barSummary.byMonth) { const k = monthKey(r.y, r.m); quotesM.set(k, r.quotes); wonM.set(k, r.won); } }
    else scopedQuotes.forEach(q => { const d = parseThaiDate(q.createdAt); if (!d) return; const k = monthKeyOf(d); bump(quotesM, k); if (q.status === "won") bump(wonM, k); });
    // ลีดต่อเดือน (คีย์ YYYY-MM): supabase = lead_summary.byMonth (all-time ครอบคลุมหน้าต่าง barRange) · local = array
    if (dashLeadSum) { for (const r of dashLeadSum.byMonth) leadsM.set(monthKey(r.y, r.m), r.created); }
    // local fallback: กรองลีดตามตัวแทนที่เลือกด้วย (M3) — ไม่งั้นแท่งลีดโชว์ทั้งเครือทั้งที่เลือกสาขาเดียว
    else allNetLeads.filter(l => !selDealer || (l.dealerCode ?? DEFAULT_DEALER_CODE) === selDealer.code)
      .forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (d) bump(leadsM, monthKeyOf(d)); });
    return {
      months: buckets.map(b => b.label),
      leads: buckets.map(b => leadsM.get(b.key) ?? 0),
      quotes: buckets.map(b => quotesM.get(b.key) ?? 0),
      won: buckets.map(b => wonM.get(b.key) ?? 0),
    };
  }, [barRange, barSummary, dashLeadSum, scopedQuotes, allNetLeads, selDealer]);

  // ── กิจกรรมล่าสุด = "บันทึกการใช้งาน" (Audit Log) แหล่งเดียวกับหน้า /hq/audit ──
  // เดิมการ์ดนี้อ่านจากใบเสนอราคา (ความเคลื่อนไหวการขาย) — บอสสั่งให้ใช้บันทึกการใช้งานแทน 17 ก.ค. 69
  // ป้ายบนไทม์ไลน์ = ชื่อการกระทำจริงของ audit ("แก้ราคากลาง") · ไอคอน/สีแยกตามโมดูล (hqAuditCategory)
  // เวลาเก็บเป็น "30 มิ.ย. 2569 · 09:22" → parseThaiDate อ่านส่วนหน้าได้ ใช้กรองตามช่วงเวลาของหน้าได้เลย
  const auditEntries = useAuditEntries();
  const AUDIT_ICON: Record<string, string> = {
    dealer: "meeting",   // ตัวแทน → ไอคอนกลุ่มคน
    users: "meeting",
    pricing: "quote",    // ราคากลาง/แม่แบบ → ไอคอนเอกสาร
    catalog: "quote",
    target: "status",    // เป้า/ตั้งค่า → ไอคอนเปลี่ยนสถานะ
  };
  const recentActivities = useMemo<ActivityTimelineItem[]>(() => {
    const inRange = (at: string) => {
      const d = parseThaiDate(at);
      return !d || (d >= timeRange.start && d <= timeRange.end); // อ่านวันไม่ได้ = ไม่ตัดทิ้ง
    };
    return auditEntries
      .filter(e => inRange(e.at))
      // เลื่อนอ่านในการ์ดได้ จึงไม่ต้องตัดเหลือ 7 รายการเหมือนตอนยังไม่มีแถบเลื่อน
      // เพดาน 50 กันการ์ดวาดยาวเกินจำเป็น (บันทึกทั้งหมดดูได้ที่หน้า "บันทึกการใช้งาน" ซึ่งเก็บสูงสุด 300)
      .slice(0, 50)
      .map(e => ({
        id: e.id,
        type: AUDIT_ICON[hqAuditCategory(e.action)] ?? "note",
        label: e.action,
        text: `${e.user} · ${e.target}`,
        time: e.at,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditEntries, timeRange]);

  const topDealers = useMemo(() => rankedWin.slice(0, 5), [rankedWin]);

  // ── กราฟวิเคราะห์เพิ่มเติม (ตามสเปคใหม่) ──
  // เป้า vs ทำได้จริง รายเดือน (ล้านบาท)
  // ── กราฟแท่ง "เป้าหมาย เทียบ ยอดขายจริง" — ปุ่มช่วงย้อนหลังของตัวเอง (กติกาเดียวกับกราฟแนวโน้มใบอื่น) ──
  // เป้ารายเดือน = เป้าทั้งปี ÷ 12 (เท่ากันทุกเดือน) · ยอดจริง = ใบที่ปิดการขายได้ในเดือนนั้น
  const [tgtRange, setTgtRange] = useState<MonthRange>(6);
  // สรุปใบในหน้าต่าง tgtRange ที่ DB (byMonth.wonVal) — supabase · local/ยังไม่กลับ = scopedQuotes เดิม
  const tgtSummary = useDashboardQuoteSummary(
    new Date(APP_NOW.getFullYear(), APP_NOW.getMonth() - (tgtRange - 1), 1),
    new Date(APP_NOW.getFullYear(), APP_NOW.getMonth() + 1, 0), selDealer?.code);
  const targetVsActual = useMemo(() => {
    const planM = Math.round(targets.annualTarget / 12 / 1e6 * 10) / 10;
    const actM = new Map<string, number>();
    if (tgtSummary) { for (const r of tgtSummary.byMonth) actM.set(monthKey(r.y, r.m), r.wonVal); }
    else scopedQuotes.forEach(q => {
      if (q.status !== "won") return;
      const d = parseThaiDate(q.createdAt); if (!d) return;
      actM.set(monthKeyOf(d), (actM.get(monthKeyOf(d)) ?? 0) + q.valueNum);
    });
    return lastNMonths(tgtRange, APP_NOW).map(b => ({
      label: b.label,
      actual: Math.round((actM.get(b.key) ?? 0) / 1e6 * 10) / 10,
      plan: planM,
    }));
  }, [scopedQuotes, tgtSummary, targets, tgtRange]);

  // lostReasons ถูกลบพร้อมการ์ด — ไม่มีใครอ่านผลแล้ว

  // คาดการณ์รายได้ (Forecast) = แนวโน้ม + ต่ออีก 3 เดือนตามอัตราเติบโต
  const forecast = useMemo(() => {
    const vals = trendMonthly.map(p => p.value);
    const last = vals[vals.length - 1] ?? 0, prev = vals[vals.length - 2] ?? last;
    const g = prev > 0 ? Math.min(Math.max(last / prev, 1), 1.4) : 1.08;
    const proj: number[] = []; let v = last;
    for (let i = 0; i < 3; i++) { v = Math.round(v * g * 10) / 10; proj.push(v); }
    const nextMo: string[] = []; let mi = timeRange.end.getMonth();
    for (let i = 0; i < 3; i++) { mi = (mi + 1) % 12; nextMo.push(TH_ABBR[mi]); }
    return { months: [...trendMonthly.map(p => p.month), ...nextMo], data: [...vals, ...proj], splitAt: vals.length };
  }, [trendMonthly, timeRange]);

  // การ์ด KPI 6 ใบ — ดีไซน์เดียวกับแดชบอร์ดตัวแทน (ไอคอนพาสเทล · (i) คำอธิบาย · การ์ดเป้าหมายเป็นวงแหวน · "ดูรายละเอียด")
  const kpiCards = [
    { label: "เป้าหมายยอดขายทั้งเครือ", tip: "เป้าหมายยอดขายทั้งปีของทั้งเครือ เทียบกับยอดปิดการขายสะสมในช่วงเวลาที่เลือก", Icon: Target, color: "#2563EB", bg: "#E8F0FE", href: "/hq/quotations", ring: true },
    { label: "ใบเสนอราคารวม", tip: "จำนวนใบเสนอราคาทั้งเครือในช่วงเวลาที่เลือก", Icon: FileText, color: "#0891B2", bg: "#E6F4F9", href: "/hq/quotations", value: sc.quotes.value, sub1: "ใบ" },
    { label: "ลูกค้าทั้งเครือ", tip: "จำนวนลูกค้าทั้งหมดในเครือ", Icon: Users2, color: "#7C3AED", bg: "#F0EBFB", href: "/hq/customers", value: sc.customers.value, sub1: "ราย" },
    { label: "ดีลที่ปิดการขาย", tip: "จำนวนดีลที่ปิดการขายสำเร็จในช่วงเวลาที่เลือก", Icon: Trophy, color: "#D97706", bg: "#FEF0E6", href: "/hq/quotations", value: sc.won.value, sub1: "ดีล" },
  ];
  const kSub: React.CSSProperties = { fontSize: "0.8rem", color: "var(--muted-foreground)" };
  const kNum: React.CSSProperties = { fontSize: "1.25rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const kDetail = (href: string) => (
    <button onClick={() => router.push(href)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.8rem", fontWeight: 700, color: PRIMARY, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", marginTop: "auto" }}>
      ดูรายละเอียด <ChevronRight size={13} />
    </button>
  );
  const KIconBox = ({ Icon, color, bg }: { Icon: typeof Target; color: string; bg: string }) => (
    <span style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={20} color={color} strokeWidth={2.1} />
    </span>
  );
  const KLabel = ({ label, tip }: { label: string; tip: string }) => (
    <span style={{ ...kSub, display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span title={tip} aria-label={tip} style={{ display: "inline-flex", cursor: "help", flexShrink: 0 }}><Info size={12} color="#94A3B8" /></span>
    </span>
  );

  // รายได้ต่อภูมิภาค → ป้อนแผนที่ (heat ตาม tier)
  const regionRevenue = useMemo(() => { const m: Record<string, number> = {}; regions.forEach(r => { m[r.region] = r.revenue; }); return m; }, [regions]);

  // เกณฑ์สี Win rate อิงเป้าที่ตั้งใน /hq/settings → เป้าหมายยอดขาย (ถึงเป้า=เขียว, ใกล้=กรม, ต่ำ=เหลือง)
  const wt = targets.winRateTarget;
  const winColor = (w: number) => w >= wt ? "#059669" : w >= wt - 10 ? PRIMARY : "#b7892a";
  const winTone = (w: number) => w >= wt ? { background: "#e5faf0", color: "#059669" }
    : w >= wt - 10 ? { background: "#dce5f0", color: PRIMARY }
    : { background: "#fef3cd", color: "#b7892a" };

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          {/* เดิมเขียนว่า "ทุกตัวเลขคำนวณตามช่วงเวลาที่เลือก" ซึ่งไม่จริง — การ์ดที่มีปุ่มช่วงของตัวเอง
              (ลีด·ใบเสนอราคา·ปิดการขาย · เป้าหมายเทียบยอดขายจริง) และการ์ด "สัดส่วนตัวแทนจำหน่าย" ที่ใช้ยอดสะสมทั้งปี
              ไม่ได้อิงตัวกรองบนแถบบน — ทุกใบกำกับไว้ที่ใบของมันเองแล้ว */}
          <p style={{ margin: 0 }}>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code})` : "ภาพรวมทุกตัวแทน · การ์ดที่ไม่ได้กำกับเป็นอย่างอื่น คำนวณตามช่วงเวลาที่เลือก"} · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* เลือกดูภาพรวมทั้งเครือ หรือเจาะรายตัวแทน — ตัวเลือกเฉพาะหน้านี้ (UI เดียวกับตัวกรองเวลา) */}
          <SelectFilter caption="ทุกตัวแทน (ทั้งเครือ)" value={dealerSel}
            options={allDealers.map(d => ({ value: d.code, label: `${d.code} – ${d.name}` }))}
            onChange={setDealerSel} />
          <FilterBar dims={[]} />
        </div>
      </div>

      {/* KPI 4 ใบ — ดีไซน์เดียวกับแดชบอร์ดตัวแทน (การ์ดเป้าหมาย=วงแหวน · ที่เหลือ=ไอคอน + "ดูรายละเอียด") */}
      <div className="hq-kpi4" style={{ marginBottom: "1.5rem" }}>
        {kpiCards.map(k => (
          <div key={k.label} className="card" style={{ marginBottom: 0, padding: "18px 18px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
            {k.ring ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <KLabel label={k.label} tip={k.tip} />
                    <div style={{ ...kNum, marginTop: 6 }}>{fmtBaht(targets.annualTarget)}</div>
                    <div style={{ ...kSub, marginTop: 2 }}>เป้าหมายทั้งปี</div>
                  </div>
                  <ProgressRing pct={Math.round(annualWonTotal / (targets.annualTarget || 1) * 100)} size={50} />
                </div>
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtBaht(annualWonTotal)}</div>
                  <div style={kSub}>ยอดขายสะสมทั้งปีนี้</div>
                </div>
                {kDetail(k.href)}
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <KLabel label={k.label} tip={k.tip} />
                    <div style={{ ...kNum, marginTop: 6 }}>{k.value}</div>
                    <div style={{ ...kSub, marginTop: 2 }}>{k.sub1}</div>
                  </div>
                  <KIconBox Icon={k.Icon} color={k.color} bg={k.bg} />
                </div>
                {kDetail(k.href)}
              </>
            )}
          </div>
        ))}
      </div>

      {/* แถวการ์ดแจ้งเตือน (ลีดไม่มีผู้รับผิดชอบ/ไม่ติดต่อ/ใบใกล้หมดอายุ/ตัวแทนยอดต่ำ) เอาออกตามที่บอสสั่ง */}

      {/* แถว 1: แนวโน้มยอดขายรวม · ยอดขายตามภูมิภาค */}
      <div className="hq-row2a" style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-body" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: "1.15rem" }}>
            {/* height = ความสูงจริงของกราฟเป็น px (หลัง LineTrendChart วัดความกว้างการ์ดเอง)
                395 = ที่ว่างในการ์ดหลังหักหัวข้อ/ปุ่มช่วงเวลา — พอดีกับการ์ด "สัดส่วนตัวแทนจำหน่าย" ที่อยู่คู่กัน */}
            <SalesTrendChart title={trendTitle} desc={trendDesc} monthly={trendMonthly} height={395} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">สัดส่วนตัวแทนจำหน่าย</div>
              {/* การ์ดนี้ไม่ขึ้นกับตัวกรองเวลา — จำนวนตัวแทนไม่มีวันที่ให้กรอง และยอดขายใช้ยอดสะสมทั้งปี
                  (ค่าเดียวกับ revenueActual ที่หน้า /hq/dealers ใช้) · ต้องกำกับไว้ ไม่งั้นขัดกับคำโปรยบนหัวหน้า */}
              <div className="card-desc">จำนวนตัวแทนแยกตามภาค — ไม่ขึ้นกับตัวกรองช่วงเวลา</div>
            </div>
            <Link href="/hq/dealers" className="btn btn-secondary btn-sm">จัดการ →</Link>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            {(() => {
              const totC = regions.reduce((s, r) => s + r.count, 0) || 1;
              // สีผูกกับ "ภาค" ไม่ใช่ลำดับ — โดนัทกับแถบล่างเรียงคนละแบบ ถ้าสีอิง index ภาคเดียวกันจะคนละสีในสองที่
              const colorOf = new Map(regions.map((r, i) => [r.region, RAMP[i % RAMP.length]]));
              const segs = regions.map(r => ({ region: r.region, label: regionDisplay(r.region), value: r.count, color: colorOf.get(r.region)!, revenue: r.revenue, pct: Math.round(r.count / totC * 100) }));
              // โดนัท/legend โชว์ "จำนวนตัวแทน" → ต้องเรียงตามจำนวนตัวแทน
              // (เดิมเรียงตามยอดขายแต่โชว์จำนวน → legend ออกมา 12,12,7,5,7,5 เหมือนไม่ได้เรียง คนอ่านนึกว่าพัง)
              const byCount = [...segs].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "th"));
              // แถบล่างโชว์ "ยอดขาย" → เรียงตามยอดขาย · แสดงครบทุกภาค ไม่ตัดเงียบ
              const byRev = [...segs].sort((a, b) => b.revenue - a.revenue);
              const maxRev = Math.max(...segs.map(s => s.revenue), 1);
              return (
                <>
                  {/* โดนัทสัดส่วน + legend (สไตล์ Chateau) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Donut segments={byCount} centerLabel="ตัวแทน" centerValue={`${totalDealers}`} size={140} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {byCount.map(s => (
                        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                          <span style={{ fontWeight: 800, color: "#1F2937" }}>{s.value}</span>
                          <span style={{ color: "var(--muted-foreground)", minWidth: 32, textAlign: "right", fontWeight: 700 }}>{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* ยอดขายตามภูมิภาค (bars ใต้โดนัท เหมือน "รายได้ตาม Plan")
                      แสดงครบทุกภาค — เดิม slice(0,3) ตัดทิ้ง 3 ภาคโดยไม่บอก (ขัดกฎ "ห้ามตัดเงียบ" ของโปรเจกต์) */}
                  <div style={{ borderTop: "1px solid #f0f4f8", marginTop: 16, paddingTop: 13 }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 11 }}>ยอดขายตามภูมิภาค <span style={{ fontWeight: 400 }}>(ยอดสะสมทั้งปี · ทุกภาค)</span></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      {byRev.map(s => (
                        <div key={s.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 3 }}>
                            <span style={{ color: "#374151", fontWeight: 600 }}>{s.label}</span>
                            <span style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(s.revenue)}</span>
                          </div>
                          <div style={{ height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                            <div className="bar-grow" style={{ height: "100%", width: `${Math.round(s.revenue / maxRev * 100)}%`, background: s.color, borderRadius: 999 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* แถว 2: ลีด·ใบเสนอราคา·ปิดการขาย · เป้าหมายเทียบยอดขายจริง */}
      <div className="hq-row2b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div className="card-title">ลีด · ใบเสนอราคา · ปิดการขาย (รายเดือน)</div>
            <MonthRangeToggle value={barRange} onChange={setBarRange} label="ช่วงเวลากราฟลีด·ใบเสนอราคา·ปิดการขาย" />
          </div>
          {/* ปุ่มช่วงคุมกราฟใบนี้ใบเดียว ไม่ขึ้นกับตัวกรองเวลาบนแถบบน → ต้องบอกช่วงที่ครอบไว้ตรงนี้ */}
          <div style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", padding: "0 1.15rem 2px" }}>
            จำนวนรายการต่อเดือน · {monthRangeSubtitle(barRange, APP_NOW)}
          </div>
          <div className="card-body" style={{ paddingTop: 4, flex: 1 }}>
            {/* แท่งกลุ่ม ไม่ใช่แท่งซ้อน — ลีด/ใบเสนอราคา/ปิดการขาย เป็นขั้นของดีลเดียวกัน บวกกันแล้วยอดรวมไม่มีความหมาย */}
            <GroupedBarChart months={barTrend.months} vw={820} height={260} fmt={v => `${Math.round(v)}`}
              series={[
                { name: "ลูกค้าเป้าหมาย", color: "#003366", data: barTrend.leads },
                { name: "ใบเสนอราคา", color: "#0891b2", data: barTrend.quotes },
                { name: "ปิดการขาย", color: "#10B981", data: barTrend.won },
              ]} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">เป้าหมาย เทียบ ยอดขายจริง</div>
            <MonthRangeToggle value={tgtRange} onChange={setTgtRange} label="ช่วงเวลากราฟเป้าหมายเทียบยอดขายจริง" />
          </div>
          {/* ปุ่มช่วงคุมกราฟใบนี้ใบเดียว ไม่ขึ้นกับตัวกรองเวลาบนแถบบน → ต้องบอกช่วงที่ครอบไว้ตรงนี้ */}
          <div style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", padding: "0 1.15rem 2px" }}>
            หน่วย: ล้านบาท · {monthRangeSubtitle(tgtRange, APP_NOW)} · เป้ารายเดือน = เป้าทั้งปี ÷ 12
          </div>
          {/* ป้ายต้องตรงกับหัวการ์ด — ค่าเริ่มต้นของกราฟคือ "จริง"/"แผน" ซึ่งไม่ใช่คำที่หน้านี้ใช้ */}
          <div className="card-body" style={{ paddingTop: 8 }}>
            <PlanVsActualBars data={targetVsActual} unit="M" aLabel="ยอดขายจริง" bLabel="เป้าหมาย" />
          </div>
        </div>
      </div>

      {/* แถว 3: ผลงานตัวแทน Top 10 · ยอดขายตามประเภทอาคาร · เหตุผลปิดการขายไม่สำเร็จ */}
      {/* minHeight = พื้นการ์ดขั้นต่ำของแถวนี้ (แถวนี้เป็น grid + stretch → การ์ดสูงเท่าใบที่เนื้อสูงสุด)
          เดิมไม่ได้กำหนดไว้ พอเครือข่ายยังมีตัวแทนน้อยและประเภทอาคารไม่กี่ชนิด สองใบซ้ายเตี้ยมาก
          แถวเลยเตี้ยตาม แล้วการ์ด "กิจกรรมล่าสุด" ที่ยาวกว่าถูกบีบจนเห็นแค่ 2 รายการต้องเลื่อนตลอด
          ใช้ 340px = ขนาด .chart-m ของ design system (เพดานคือ .chart-l 420px ห้ามเกิน)
          เป็น min ไม่ใช่ height ตายตัว — พอตัวแทนครบ 10 รายการ์ดยังยืดเองได้ ไม่โดนตัดข้อมูลทิ้ง */}
      <div className="hq-row3c" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem", minHeight: 340 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ผลงานตัวแทนจำหน่าย 10 อันดับแรก</div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", fontSize: "0.68rem", color: "var(--muted-foreground)", paddingLeft: 26, gap: 8 }}>
              <span style={{ flex: 1 }} /><span style={{ flex: "0 0 44px", textAlign: "right" }}>ยอดขาย</span><span style={{ flex: "0 0 34px", textAlign: "right" }}>% เป้า</span><span style={{ flex: "0 0 44px", textAlign: "right" }}>อัตราปิด</span>
            </div>
            {(() => { const maxRev = Math.max(...rankedWin.map(d => d.revenueW), 1); return rankedWin.slice(0, 10).map((d, i) => (
              // แถวอันดับนี้คลิกไปหน้าตัวแทนได้ — ต้องกดด้วยคีย์บอร์ดได้ด้วย (role/tabIndex/Enter-Space)
              // ไม่เปลี่ยนเป็น <button> เพราะข้างในมีแถบกราฟที่เป็น div (ปุ่มรับได้แต่เนื้อหาแบบ phrasing)
              <div key={d.code} className="clickable" role="button" tabIndex={0}
                aria-label={`เปิดหน้าตัวแทน ${d.name}`}
                onClick={() => router.push(`/hq/dealers/${d.code}`)}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); router.push(`/hq/dealers/${d.code}`); } }}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, textAlign: "center", fontSize: "0.74rem", fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: "0 0 84px", fontSize: "0.76rem", fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name.replace("Benjamin ", "")}</span>
                <div style={{ flex: 1, height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden", minWidth: 20 }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${Math.round(d.revenueW / maxRev * 100)}%`, background: PRIMARY, borderRadius: 999 }} />
                </div>
                <span style={{ flex: "0 0 44px", fontSize: "0.76rem", fontWeight: 800, color: "#1F2937", textAlign: "right" }}>฿{(d.revenueW / 1e6).toFixed(1)}M</span>
                <span style={{ flex: "0 0 34px", fontSize: "0.74rem", fontWeight: 700, color: PRIMARY, textAlign: "right" }}>{d.tpct}%</span>
                <span style={{ flex: "0 0 44px", fontSize: "0.74rem", fontWeight: 700, color: "var(--muted-foreground)", textAlign: "right" }}>{d.convW === null ? "—" : `${d.convW}%`}</span>
              </div>
            )); })()}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ยอดขายตามประเภทอาคาร</div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span></div>
          {/* ใบนี้เป็นต้นแบบของ CategoryRows — แดชบอร์ดตัวแทนใช้คอมโพเนนต์ตัวเดียวกัน (ห้ามแยกมาร์กอัป) */}
          <div className="card-body" style={{ paddingTop: 4 }}>
            <CategoryRows
              data={buildingPerf.map(p => ({ label: p.product, value: p.value, note: `${p.projects} โครงการ` }))}
              fmt={fmtBaht} icon={<Building2 size={11} />}
              ariaLabel="ยอดขายแยกตามประเภทอาคาร" />
          </div>
        </div>
        {/* การ์ด "เหตุผลปิดการขายไม่สำเร็จ" เอาออกตามที่บอสสั่ง → ช่องที่ว่างใส่ "กิจกรรมล่าสุด" แทน
            (recentActivities คำนวณไว้อยู่แล้วแต่ไม่เคยถูกเรนเดอร์ — โค้ดตายมาตลอด) */}
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div className="card-title">กิจกรรมล่าสุด</div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>จากบันทึกการใช้งาน · ตามตัวกรองด้านบน</span>
          </div>
          {/* กล่องเลื่อน: ตัวเนื้อเป็น absolute → ความสูงของรายการ "ไม่ถูกนับ" เป็นความสูงการ์ด
              จำเป็น เพราะแถวนี้เป็น grid + align-items: stretch ซึ่งคิดความสูงแถวจากการ์ดที่เนื้อสูงสุด
              ถ้าปล่อยให้เนื้อดันเอง พอกิจกรรมเยอะการ์ดจะยืดจนแถวสูงตาม แล้วจะไม่มีวันเกิดแถบเลื่อนเลย */}
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            <div className="chart-scroll" style={{ position: "absolute", inset: 0, padding: "4px 1.15rem 1.15rem" }}>
              <ActivityTimeline items={recentActivities} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// วงแหวนความคืบหน้าใช้ ProgressRing จาก @pms/shared/components/ui/Charts — แหล่งเดียวร่วมกับแดชบอร์ดตัวแทน
// (เดิมเขียนซ้ำไว้ที่นี่ แต่ตกตัวแก้ที่ทำให้แอนิเมชันวิ่ง วงแหวนเลยนิ่งอยู่ที่ค่าจริงตั้งแต่เฟรมแรก)

// เคยมีกราฟที่เขียนไว้เองในไฟล์นี้อีก 4 ตัว (GroupedBar / Sparkline / StatusBars / ThailandMap)
// แต่ไม่มีที่ไหนเรียกใช้เลย — เหลือค้างจากตอนย้ายไปใช้กราฟกลางใน @pms/shared/components/ui/Charts
// ลบออกแล้ว (ตรวจสอบระบบ 5 ส.ค. 69) ถ้าต้องการกราฟแบบนั้นอีก ให้เพิ่มที่ Charts.tsx เพื่อใช้ร่วมกัน
