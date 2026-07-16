"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign, MapPin, Trophy, Building2, XCircle, Percent,
  FileText, ChevronRight, Users2, CalendarClock,
  ArrowUpRight, ArrowDownRight, Target, Activity, RefreshCw, Info,
} from "lucide-react";
import { PlanVsActualBars, GroupedBarChart, Donut, ProgressRing } from "@/components/ui/Charts";
import { ActivityTimeline, type ActivityTimelineItem } from "@/components/ui/ActivityTimeline";
import {
  dealerLeaderboard, HQ_DEALERS_KEY, DEFAULT_HQ_TARGETS, HQ_TARGETS_KEY, quotationStatusLabel, quotationStatusColor, loadHQPolicy,
  type DealerRow, type HQTargets,
} from "@/lib/mock";
import { usePersistentState } from "@/lib/usePersistentState";
import { useFilters, APP_NOW } from "@/context/FilterContext";
import { FilterBar, SelectFilter } from "@/components/filters/FilterBar";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { useNetworkQuotations, useNetworkCustomers, useNetworkLeads } from "@/lib/useNetworkData";

import { useSales } from "@/context/SalesContext";
import { fmtBaht, parseBaht } from "@/lib/format";

const PRIMARY = "#003366";
// palette หลายสีสำหรับกราฟรายภาค/แม่แบบ — navy หลัก + สีเสริม (ไม่ฉูดฉาด)
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
const TH_MONTH: Record<string, number> = { "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5, "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11 };
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(s.trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const addDaysD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── แผนที่ความครอบคลุมรายภูมิภาค — สี heat ตามยอดขาย (tier) ──
const tierColor = (rev: number) => rev >= 10e6 ? "#003366" : rev >= 5e6 ? "#3b6fb5" : rev >= 1e6 ? "#93b4dd" : rev > 0 ? "#cdddf0" : "#eef1f5";
const TIER_LEGEND = [
  { label: "มากกว่า 10M", color: "#003366" },
  { label: "5M – 10M", color: "#3b6fb5" },
  { label: "1M – 5M", color: "#93b4dd" },
  { label: "น้อยกว่า 1M", color: "#cdddf0" },
  { label: "ไม่มีข้อมูล", color: "#eef1f5" },
];
const regionDisplay = (r: string) => r === "อีสาน" ? "ภาคตะวันออกเฉียงเหนือ" : `ภาค${r}`;
// จังหวัดที่ตั้งของตัวแทน (ตามรหัสสาขา) — ใช้ในตารางสรุปผลงาน
const DEALER_PROVINCE: Record<string, string> = {
  RYG: "ระยอง", CNX: "เชียงใหม่", MST: "ตาก", CRI: "เชียงราย", NSN: "นครสวรรค์",
  HYI: "สงขลา", AYA: "พระนครศรีอยุธยา", KKN: "ขอนแก่น", UBN: "อุบลราชธานี", PKT: "ภูเก็ต",
};
// รูปทรงภูมิภาค — 6 ภาคต่อขอบกันเป็นเงาประเทศไทย (ใช้จุดร่วมขอบเพื่อไม่ให้มีช่องว่าง) viewBox 0 0 160 260
const THAI_REGION_PATHS: Record<string, string> = {
  "เหนือ":     "M54 42 L56 22 L62 11 L96 8 L110 38 L96 60 L72 62 Z",
  "อีสาน":     "M110 38 L148 46 L150 104 L118 120 L100 104 L96 60 Z",
  "กลาง":      "M72 62 L96 60 L100 104 L86 124 L70 116 L68 88 Z",
  "ตะวันตก":   "M54 42 L72 62 L68 88 L70 116 L62 150 L50 150 L42 110 L44 70 Z",
  "ตะวันออก":  "M100 104 L118 120 L130 144 L100 150 L86 124 Z",
  "ใต้":       "M62 150 L70 116 L86 124 L88 150 L82 190 L74 224 L64 252 L56 252 L54 214 L58 178 Z",
};

export default function HQDashboard() {
  const router = useRouter();
  const { timeRange } = useFilters();
  // ข้อมูลตัวแทน = ชุดเดียวกับหน้า "ตัวแทน" (persist ผ่าน HQ_DEALERS_KEY) — คุณสมบัติคงที่ (ชื่อ/ภาค/เป้าทั้งปี/สถานะ)
  const [allDealers] = usePersistentState<DealerRow[]>(HQ_DEALERS_KEY, dealerLeaderboard);
  // เป้าหมายที่ HQ ตั้งไว้ (แหล่งเดียว) — ใช้เป็นเกณฑ์สี Win rate แทนการ hardcode
  const [targets] = usePersistentState<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
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
  const { appointments } = useSales();
  const totalDealers = allDealers.length;
  // ── ใบเสนอราคาในช่วงเวลาที่เลือก (แหล่งข้อมูลเดียวของทั้งหน้า) + หน้าต่างก่อนหน้าสำหรับ trend ──
  const { winQuotes, prevQuotes } = useMemo(() => {
    const s = timeRange.start, e = timeRange.end;
    const ps = addDaysD(s, -periodDays), pe = addDaysD(s, -1);
    const base = selDealer ? netQuotes.filter(q => q.dealerCode === selDealer.code) : netQuotes;
    const inR = (createdAt: string, a: Date, b: Date) => { const d = parseThaiDate(createdAt); return !!d && d >= a && d <= b; };
    return {
      winQuotes: base.filter(q => inR(q.createdAt, s, e)),
      prevQuotes: base.filter(q => inR(q.createdAt, ps, pe)),
    };
  }, [netQuotes, timeRange.start, timeRange.end, periodDays, selDealer]);

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
    const cur = statsOf(winQuotes), prev = statsOf(prevQuotes);
    const pctf = (c: number, p: number) => p > 0 ? Math.round(((c - p) / p) * 100) : (c > 0 ? 100 : 0);
    return {
      dealers:   { value: `${totalDealers}`, trend: 0 },
      leads:     { value: `${allNetLeads.length}`, trend: 0 },
      customers: { value: `${netCustomers.length}`, trend: 0 },
      quotes:    { value: `${cur.quotes}`, trend: pctf(cur.quotes, prev.quotes) },
      wonVal:    { value: fmtBaht(cur.wonVal), trend: pctf(cur.wonVal, prev.wonVal) },
      won:       { value: `${cur.won}`, trend: pctf(cur.won, prev.won) },
      lost:      { value: `${cur.lost}`, trend: pctf(cur.lost, prev.lost) },
      conv:      { value: `${cur.conv}%`, trend: pctf(cur.conv, prev.conv) },
    };
  }, [winQuotes, prevQuotes, totalDealers, allNetLeads.length, netCustomers.length]);

  // ── สถิติรายตัวแทนในช่วง (รายได้=มูลค่า won, Win rate=won/ทั้งหมด) ──
  const dealerStats = useMemo(() => {
    const m = new Map<string, { revenue: number; total: number; won: number }>();
    winQuotes.forEach(q => {
      const r = m.get(q.dealerCode) ?? { revenue: 0, total: 0, won: 0 };
      r.total += 1;
      if (q.status === "won") { r.won += 1; r.revenue += q.valueNum; }
      m.set(q.dealerCode, r);
    });
    return m;
  }, [winQuotes]);

  // อันดับตัวแทน — ใช้ยอดขาย/เป้า/อัตราปิด "ทางการ" ของ dealer (revenueActual/revenueTarget/winRate)
  // ให้ตรงกับหน้าตัวแทน + หน้ารายงาน (จำนวนใบเสนอราคายังนับตามช่วงเวลาจริง)
  const rankedWin = useMemo(() => dealers.map(d => {
    const st = dealerStats.get(d.code) ?? { revenue: 0, total: 0, won: 0 };
    const tpct = d.revenueTarget > 0 ? Math.round((d.revenueActual / d.revenueTarget) * 100) : 0;
    return { ...d, revenueW: d.revenueActual, winRateW: d.winRate, quotesW: st.total, wonW: st.won, tpct };
  }).sort((a, b) => b.revenueW - a.revenueW), [dealers, dealerStats]);
  const best = rankedWin[0];

  // ยอดขายรายเดือนในช่วง (ล้านบาท) ป้อนกราฟแนวโน้ม — สรุปจาก won ในช่วงที่เลือก
  const trendMonthly = useMemo(() => {
    const byMonth = new Map<number, number>();
    winQuotes.forEach(q => {
      if (q.status !== "won") return;
      const d = parseThaiDate(q.createdAt); if (!d) return;
      byMonth.set(d.getMonth(), (byMonth.get(d.getMonth()) ?? 0) + q.valueNum);
    });
    const pts: { month: string; value: number }[] = [];
    for (let m = timeRange.start.getMonth(); m <= timeRange.end.getMonth(); m++) {
      pts.push({ month: TH_ABBR[m], value: Math.round((byMonth.get(m) ?? 0) / 1e6 * 10) / 10 });
    }
    return pts.length ? pts : [{ month: TH_ABBR[timeRange.end.getMonth()], value: 0 }];
  }, [winQuotes, timeRange.start, timeRange.end]);
  const trendTitle = selDealer ? `ยอดขาย ${selDealer.name.replace("Benjamin ", "")} รายเดือน` : "ยอดขายรวมทั้งเครือ รายเดือน";
  const trendDesc = selDealer ? `เฉพาะตัวแทน ${selDealer.code} (ล้านบาท)` : "มูลค่าที่ปิดได้ทุกตัวแทนรวมกัน (ล้านบาท)";

  // ผลงานรายภาค (รายได้ในช่วง)
  const regions = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    rankedWin.forEach(d => {
      const r = m.get(d.region) ?? { revenue: 0, count: 0 };
      r.revenue += d.revenueW; r.count += 1;
      m.set(d.region, r);
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v })).sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(...arr.map(a => a.revenue), 1);
    return arr.map(a => ({ ...a, pct: Math.round((a.revenue / max) * 100) }));
  }, [rankedWin]);

  // สัดส่วนมูลค่าตามแม่แบบ (มูลค่าใบเสนอราคาในช่วง แยกตาม productLine)
  const productAgg = useMemo(() => {
    const m = new Map<string, number>();
    winQuotes.forEach(q => m.set(q.productLine, (m.get(q.productLine) ?? 0) + q.valueNum));
    const arr = [...m.entries()].map(([product, valueNum]) => ({ product, valueNum })).sort((a, b) => b.valueNum - a.valueNum);
    return arr.map((p, i) => ({ ...p, color: RAMP[i % RAMP.length] }));
  }, [winQuotes]);

  // ── ใบเสนอราคา เทียบ ปิดการขาย (รายเดือน) + การวิเคราะห์การแปลง (Funnel เป็นแถบ) ──
  const quoteWonSeries = useMemo(() => {
    const qC = Array(12).fill(0), wC = Array(12).fill(0);
    winQuotes.forEach(q => { const d = parseThaiDate(q.createdAt); if (!d) return; const m = d.getMonth(); qC[m]++; if (q.status === "won") wC[m]++; });
    return { qC, wC };
  }, [winQuotes]);
  // ── Sales Journey Pipeline — การ์ดขั้นตอนแนวนอน (ไม่ใช่ funnel/กรวย) ──
  const journeyStages = useMemo(() => {
    const rank: Record<string, number> = { WAITING: 1, BULLET: 2, QUOTED: 3, FOLLOWUP: 3, NEGO: 4, PAID: 5 };
    const rk = (s: string) => rank[s] ?? 0;
    const total = allNetLeads.length;
    const defs = [
      { label: "ลูกค้าเป้าหมาย", r: 0 },
      { label: "ติดต่อแล้ว", r: 1 },
      { label: "รวบรวมความต้องการ", r: 2 },
      { label: "เสนอราคา", r: 3 },
      { label: "เจรจาต่อรอง", r: 4 },
      { label: "ปิดการขาย", r: 5 },
    ];
    return defs.map(d => {
      const arr = d.r === 0 ? allNetLeads : allNetLeads.filter(l => rk(l.status) >= d.r);
      return {
        label: d.label,
        count: arr.length,
        pct: total ? Math.round((arr.length / total) * 100) : 0,
        value: arr.reduce((s, l) => s + parseBaht(l.value), 0),
      };
    });
  }, [allNetLeads]);

  // ── Lead vs Quotation (รายเดือน) ──
  const leadQuoteSeries = useMemo(() => {
    const lC = Array(12).fill(0), qC = Array(12).fill(0);
    allNetLeads.forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (d) lC[d.getMonth()]++; });
    netQuotes.forEach(q => { const d = parseThaiDate(q.createdAt); if (d) qC[d.getMonth()]++; });
    return { lC, qC };
  }, [allNetLeads, netQuotes]);

  // ── สถานะใบเสนอราคา (กราฟแท่ง) — สีตามสเปค: ร่าง เทา · ส่ง navy · ตอบรับ เขียว · ปฏิเสธ แดง · หมดอายุ ส้ม ──
  const quoteStatus = useMemo(() => {
    const order = [
      { k: "draft",          label: "ร่าง",     color: "#9ca3af" },
      { k: "sent_to_client", label: "ส่งแล้ว",   color: "#003366" },
      { k: "won",            label: "ตอบรับ",   color: "#059669" },
      { k: "lost",           label: "ปฏิเสธ",   color: "#dc2626" },
      { k: "expired",        label: "หมดอายุ",  color: "#d97706" },
    ];
    return order.map(o => ({ ...o, count: winQuotes.filter(q => q.status === o.k).length }));
  }, [winQuotes]);

  // ── ยอดขายตามประเภทอาคาร (Top 5) + % ──
  const templateTotal = useMemo(() => productAgg.reduce((s, p) => s + p.valueNum, 0), [productAgg]);
  const templateTop = useMemo(() => productAgg.slice(0, 5).map(p => ({ ...p, pct: templateTotal ? Math.round(p.valueNum / templateTotal * 100) : 0 })), [productAgg, templateTotal]);

  // ตัวคำนวณ alerts ถูกลบพร้อมการ์ดแจ้งเตือน — ไม่มีใครอ่านผลแล้ว

  // ── ชุดข้อมูลรายเดือนสำหรับ sparkline บนการ์ด KPI ──
  const monthly = useMemo(() => {
    const mo = (s: string) => { const d = parseThaiDate(s); return d ? d.getMonth() : -1; };
    const salesM = Array(12).fill(0), quotesM = Array(12).fill(0), wonM = Array(12).fill(0), lostM = Array(12).fill(0), leadsM = Array(12).fill(0);
    winQuotes.forEach(q => { const m = mo(q.createdAt); if (m < 0) return; quotesM[m]++; if (q.status === "won") { wonM[m]++; salesM[m] += q.valueNum; } if (q.status === "lost") lostM[m]++; });
    allNetLeads.forEach(l => { const m = mo(l.createdAt ?? ""); if (m >= 0) leadsM[m]++; });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    const slice = (arr: number[]) => arr.slice(a, b + 1);
    const convM = wonM.map((w, i) => (w + lostM[i]) ? Math.round(w / (w + lostM[i]) * 100) : 0);
    return { sales: slice(salesM.map(v => v / 1e6)), quotes: slice(quotesM), customers: slice(leadsM), won: slice(wonM), lost: slice(lostM), conv: slice(convM) };
  }, [winQuotes, allNetLeads, timeRange]);

  // ยอดขายตามจังหวัด (Top 6) — จากลูกค้าในเครือ
  const provinceTop6 = useMemo(() => {
    const m = new Map<string, number>();
    netCustomers.forEach(c => m.set(c.province, (m.get(c.province) ?? 0) + (c.totalRevenue || 0)));
    const arr = [...m.entries()].map(([province, value]) => ({ province, value })).sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map(a => a.value), 1);
    return arr.slice(0, 6).map(p => ({ ...p, pct: Math.round(p.value / max * 100) }));
  }, [netCustomers]);

  // สถานะ Pipeline โดยรวม — จำนวน + มูลค่า ต่อสถานะ (แถบแนวนอน)
  const pipeline = useMemo(() => {
    const defs = [
      { k: "draft",          label: "ร่าง",     color: "#9ca3af" },
      { k: "sent_to_client", label: "ส่งแล้ว",   color: "#003366" },
      { k: "won",            label: "ตอบรับ",   color: "#059669" },
      { k: "lost",           label: "ปฏิเสธ",   color: "#dc2626" },
      { k: "expired",        label: "หมดอายุ",  color: "#d97706" },
    ];
    const rows = defs.map(d => { const arr = winQuotes.filter(q => q.status === d.k); return { ...d, count: arr.length, value: arr.reduce((s, q) => s + q.valueNum, 0) }; });
    const maxV = Math.max(...rows.map(r => r.value), 1);
    return { rows: rows.map(r => ({ ...r, pct: Math.round(r.value / maxV * 100) })), totalC: rows.reduce((s, r) => s + r.count, 0), totalV: rows.reduce((s, r) => s + r.value, 0) };
  }, [winQuotes]);

  // แถบล่าง — ตัวชี้วัดรอง (เดือนล่าสุดในช่วง + เทียบเดือนก่อนหน้า)
  const bottomMetrics = useMemo(() => {
    const lm = timeRange.end.getMonth();
    const cnt = (arr: string[], m: number) => arr.filter(s => { const d = parseThaiDate(s); return d && d.getMonth() === m; }).length;
    const leadDates = allNetLeads.map(l => l.createdAt ?? "");
    const quoteDates = winQuotes.map(q => q.createdAt);
    const wonThis = winQuotes.filter(q => q.status === "won" && (() => { const d = parseThaiDate(q.createdAt); return d && d.getMonth() === lm; })()).length;
    const wonPrev = winQuotes.filter(q => q.status === "won" && (() => { const d = parseThaiDate(q.createdAt); return d && d.getMonth() === lm - 1; })()).length;
    const wonArr = winQuotes.filter(q => q.status === "won");
    const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? 100 : 0);
    const nl = cnt(leadDates, lm), nlP = cnt(leadDates, lm - 1);
    const nq = cnt(quoteDates, lm), nqP = cnt(quoteDates, lm - 1);
    return {
      totalLeads: allNetLeads.length,
      newLeads: nl, newLeadsTrend: pct(nl, nlP),
      newCustomers: wonThis, newCustomersTrend: pct(wonThis, wonPrev),
      newQuotes: nq, newQuotesTrend: pct(nq, nqP),
      avgDeal: wonArr.length ? Math.round(wonArr.reduce((s, q) => s + q.valueNum, 0) / wonArr.length) : 0,
      cycleDays: 28,
    };
  }, [allNetLeads, winQuotes, timeRange]);

  // ── เป้าหมายทั้งเครือ + Achievement ──
  const wonValNum = useMemo(() => winQuotes.filter(q => q.status === "won").reduce((s, q) => s + q.valueNum, 0), [winQuotes]);
  const goalPeriod = Math.round(targets.annualTarget * periodDays / 365) || 1;
  const achievementPct = Math.round(wonValNum / goalPeriod * 100);

  // ประเภทอาคาร + จำนวนโครงการ
  const buildingPerf = useMemo(() => {
    const m = new Map<string, { value: number; projects: number }>();
    winQuotes.forEach(q => { const r = m.get(q.productLine) ?? { value: 0, projects: 0 }; r.value += q.valueNum; r.projects += 1; m.set(q.productLine, r); });
    const arr = [...m.entries()].map(([product, v]) => ({ product, ...v })).sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map(a => a.value), 1);
    return arr.slice(0, 5).map((p, i) => ({ ...p, pct: Math.round(p.value / max * 100), color: RAMP[i % RAMP.length] }));
  }, [winQuotes]);

  // Lead vs Quotation vs Won (รายเดือนในช่วง) — สำหรับกราฟแท่งซ้อน
  const rangeMonths = useMemo(() => TH_ABBR.slice(timeRange.start.getMonth(), timeRange.end.getMonth() + 1), [timeRange]);

  // กิจกรรมล่าสุดทั้งเครือ (จากใบเสนอราคาล่าสุด)
  const recentActivities = useMemo<ActivityTimelineItem[]>(() => {
    const typeOf = (st: string) => st === "won" ? "status" : st === "lost" ? "status" : "quote";
    const textOf = (q: typeof winQuotes[number]) => {
      const who = q.customer;
      if (q.status === "won") return `${who} · ปิดการขายสำเร็จ (${fmtBaht(q.valueNum)})`;
      if (q.status === "lost") return `${who} · ปิดการขายไม่สำเร็จ`;
      return `${who} · ${fmtBaht(q.valueNum)}`;
    };
    return [...winQuotes]
      .sort((a, b) => (parseThaiDate(b.createdAt)?.getTime() ?? 0) - (parseThaiDate(a.createdAt)?.getTime() ?? 0))
      .slice(0, 7)
      .map((q, i) => ({ id: `${q.dealerCode}-${i}`, type: typeOf(q.status), text: textOf(q), time: q.createdAt }));
  }, [winQuotes]);

  const topDealers = useMemo(() => rankedWin.slice(0, 5), [rankedWin]);

  // ── กราฟวิเคราะห์เพิ่มเติม (ตามสเปคใหม่) ──
  // เป้า vs ทำได้จริง รายเดือน (ล้านบาท)
  const targetVsActual = useMemo(() => {
    const planM = Math.round(targets.annualTarget / 12 / 1e6 * 10) / 10;
    const actM = Array(12).fill(0);
    winQuotes.forEach(q => { if (q.status !== "won") return; const d = parseThaiDate(q.createdAt); if (d) actM[d.getMonth()] += q.valueNum; });
    const out: { label: string; actual: number; plan: number }[] = [];
    for (let m = timeRange.start.getMonth(); m <= timeRange.end.getMonth(); m++) out.push({ label: TH_ABBR[m], actual: Math.round(actM[m] / 1e6 * 10) / 10, plan: planM });
    return out;
  }, [winQuotes, targets, timeRange]);

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

  // ใบเสนอราคาล่าสุด
  const recentQuotes = useMemo(() => [...winQuotes]
    .sort((a, b) => (parseThaiDate(b.createdAt)?.getTime() ?? 0) - (parseThaiDate(a.createdAt)?.getTime() ?? 0)).slice(0, 6), [winQuotes]);

  // ลีดที่ยังไม่ติดต่อ (Inactive) — WAITING/FOLLOWUP
  const inactiveLeads = useMemo(() => allNetLeads.filter(l => l.status === "WAITING" || l.status === "FOLLOWUP").slice(0, 6), [allNetLeads]);

  // การ์ด KPI 6 ใบ — ดีไซน์เดียวกับแดชบอร์ดตัวแทน (ไอคอนพาสเทล · (i) คำอธิบาย · การ์ดเป้าหมายเป็นวงแหวน · "ดูรายละเอียด")
  const kpiCards = [
    { label: "เป้าหมายยอดขายทั้งเครือ", tip: "เป้าหมายยอดขายทั้งปีของทั้งเครือ เทียบกับยอดปิดการขายสะสมในช่วงเวลาที่เลือก", Icon: Target, color: "#2563EB", bg: "#E8F0FE", href: "/hq/quotations", ring: true },
    { label: "ใบเสนอราคารวม", tip: "จำนวนใบเสนอราคาทั้งเครือในช่วงเวลาที่เลือก", Icon: FileText, color: "#0891B2", bg: "#E6F4F9", href: "/hq/quotations", value: sc.quotes.value, sub1: "ใบ" },
    { label: "ลูกค้าทั้งเครือ", tip: "จำนวนลูกค้าทั้งหมดในเครือ", Icon: Users2, color: "#7C3AED", bg: "#F0EBFB", href: "/hq/customers", value: sc.customers.value, sub1: "ราย" },
    { label: "ดีลที่ปิดการขาย (Won)", tip: "จำนวนดีลที่ปิดการขายสำเร็จในช่วงเวลาที่เลือก", Icon: Trophy, color: "#D97706", bg: "#FEF0E6", href: "/hq/quotations", value: sc.won.value, sub1: "ดีล" },
  ];
  const kSub: React.CSSProperties = { fontSize: "0.72rem", color: "var(--muted-foreground)" };
  const kNum: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const kDetail = (href: string) => (
    <button onClick={() => router.push(href)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", fontWeight: 700, color: PRIMARY, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", marginTop: "auto" }}>
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
          <p style={{ margin: 0 }}>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code})` : "ภาพรวมทุกตัวแทน · ทุกตัวเลขคำนวณตามช่วงเวลาที่เลือก"} · {timeRange.subtitle}</p>
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
                  <ProgressRing pct={Math.round(wonValNum / (targets.annualTarget || 1) * 100)} size={50} />
                </div>
                <div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtBaht(wonValNum)}</div>
                  <div style={kSub}>ยอดขายปัจจุบัน</div>
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
            <SalesTrendChart title={trendTitle} desc={trendDesc} monthly={trendMonthly} height={460} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">สัดส่วนตัวแทนจำหน่าย</div>
            <Link href="/hq/dealers" className="btn btn-secondary btn-sm">จัดการ →</Link></div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            {(() => {
              const totC = regions.reduce((s, r) => s + r.count, 0) || 1;
              const segs = regions.map((r, i) => ({ label: regionDisplay(r.region), value: r.count, color: RAMP[i % RAMP.length], revenue: r.revenue, pct: Math.round(r.count / totC * 100) }));
              const maxRev = Math.max(...segs.map(s => s.revenue), 1);
              return (
                <>
                  {/* โดนัทสัดส่วน + legend (สไตล์ Chateau) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Donut segments={segs} centerLabel="ตัวแทน" centerValue={`${totalDealers}`} size={140} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {segs.map(s => (
                        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                          <span style={{ fontWeight: 800, color: "#1F2937" }}>{s.value}</span>
                          <span style={{ color: "var(--muted-foreground)", minWidth: 32, textAlign: "right", fontWeight: 700 }}>{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* ยอดขายตามภูมิภาค (bars ใต้โดนัท เหมือน "รายได้ตาม Plan") */}
                  <div style={{ borderTop: "1px solid #f0f4f8", marginTop: 16, paddingTop: 13 }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 11 }}>ยอดขายตามภูมิภาค <span style={{ fontWeight: 400 }}>(ต่อปี)</span></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      {segs.slice(0, 3).map(s => (
                        <div key={s.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 3 }}>
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
          <div className="card-header"><div className="card-title">ลีด · ใบเสนอราคา · ปิดการขาย (รายเดือน)</div></div>
          <div className="card-body" style={{ paddingTop: 4, flex: 1 }}>
            {/* แท่งกลุ่ม ไม่ใช่แท่งซ้อน — ลีด/ใบเสนอราคา/ปิดการขาย เป็นขั้นของดีลเดียวกัน บวกกันแล้วยอดรวมไม่มีความหมาย */}
            <GroupedBarChart months={rangeMonths} vw={820} height={260} fmt={v => `${Math.round(v)}`}
              series={[
                { name: "ลูกค้าเป้าหมาย (Leads)", color: "#003366", data: monthly.customers },
                { name: "ใบเสนอราคา (Quotations)", color: "#0891b2", data: monthly.quotes },
                { name: "ปิดการขาย (Won)", color: "#10B981", data: monthly.won },
              ]} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">เป้าหมาย เทียบ ยอดขายจริง</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span></div>
          <div className="card-body" style={{ paddingTop: 8 }}><PlanVsActualBars data={targetVsActual} unit="M" /></div>
        </div>
      </div>

      {/* แถว 3: ผลงานตัวแทน Top 10 · ยอดขายตามประเภทอาคาร · เหตุผลปิดการขายไม่สำเร็จ */}
      <div className="hq-row3c" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ผลงานตัวแทนจำหน่าย Top 10</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", fontSize: "0.6rem", color: "var(--muted-foreground)", paddingLeft: 26, gap: 8 }}>
              <span style={{ flex: 1 }} /><span style={{ flex: "0 0 44px", textAlign: "right" }}>ยอดขาย</span><span style={{ flex: "0 0 34px", textAlign: "right" }}>% เป้า</span><span style={{ flex: "0 0 44px", textAlign: "right" }}>อัตราปิด</span>
            </div>
            {(() => { const maxRev = Math.max(...rankedWin.map(d => d.revenueW), 1); return rankedWin.slice(0, 10).map((d, i) => (
              <div key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, textAlign: "center", fontSize: "0.66rem", fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: "0 0 84px", fontSize: "0.68rem", fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name.replace("Benjamin ", "")}</span>
                <div style={{ flex: 1, height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden", minWidth: 20 }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${Math.round(d.revenueW / maxRev * 100)}%`, background: PRIMARY, borderRadius: 999 }} />
                </div>
                <span style={{ flex: "0 0 44px", fontSize: "0.68rem", fontWeight: 800, color: "#1F2937", textAlign: "right" }}>฿{(d.revenueW / 1e6).toFixed(1)}M</span>
                <span style={{ flex: "0 0 34px", fontSize: "0.66rem", fontWeight: 700, color: PRIMARY, textAlign: "right" }}>{d.tpct}%</span>
                <span style={{ flex: "0 0 44px", fontSize: "0.66rem", fontWeight: 700, color: "var(--muted-foreground)", textAlign: "right" }}>{d.winRateW}%</span>
              </div>
            )); })()}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ยอดขายตามประเภทอาคาร</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
            {buildingPerf.map((p, i) => (
              <div key={p.product}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: p.color + "1a", color: p.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={11} /></span>
                  <span style={{ flex: 1, fontSize: "0.72rem", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(p.value)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${p.pct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", minWidth: 44, textAlign: "right", fontWeight: 700 }}>{p.projects} โครงการ</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* การ์ด "เหตุผลปิดการขายไม่สำเร็จ" เอาออกตามที่บอสสั่ง */}
      </div>

    </div>
  );
}

// ── กราฟแท่งเคียงข้าง (Grouped Bar) — 3 ชุดต่อเดือน ──
function GroupedBar({ months, series }: { months: string[]; series: { name: string; color: string; data: number[] }[] }) {
  const max = Math.max(...series.flatMap(s => s.data), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 176 }}>
        {months.map((mo, mi) => (
          <div key={mi} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 150, justifyContent: "center" }}>
              {series.map(s => (
                <div key={s.name} title={`${s.name}: ${s.data[mi] ?? 0}`}
                  style={{ width: 7, height: Math.max(2, Math.round((s.data[mi] ?? 0) / max * 140)), background: s.color, borderRadius: "3px 3px 0 0" }} />
              ))}
            </div>
            <span style={{ fontSize: "0.6rem", color: "var(--muted-foreground)" }}>{mo}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        {series.map(s => (
          <span key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.64rem", color: "#374151" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// วงแหวนความคืบหน้าใช้ ProgressRing จาก @/components/ui/Charts — แหล่งเดียวร่วมกับแดชบอร์ดตัวแทน
// (เดิมเขียนซ้ำไว้ที่นี่ แต่ตกตัวแก้ที่ทำให้แอนิเมชันวิ่ง วงแหวนเลยนิ่งอยู่ที่ค่าจริงตั้งแต่เฟรมแรก)

// ── มินิกราฟบนการ์ด KPI (เส้น + พื้นไล่เฉด) ──
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100, h = 32;
  if (!data.length) return <div style={{ height: h }} />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), rng = (max - min) || 1;
  const pts = data.map((v, i) => [data.length > 1 ? (i / (data.length - 1)) * w : 0, h - 3 - ((v - min) / rng) * (h - 7)] as [number, number]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const id = "sp" + color.replace("#", "");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── สถานะใบเสนอราคา — กราฟแท่งแนวตั้ง ──
function StatusBars({ data }: { data: { label: string; color: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 168 }}>
      {data.map(s => (
        <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#1F2937" }}>{s.count}</span>
          <div style={{ width: "62%", maxWidth: 30, height: Math.max(4, Math.round(s.count / max * 118)), background: s.color, borderRadius: "6px 6px 0 0" }} />
          <span style={{ fontSize: "0.6rem", color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── แผนที่ภูมิภาคประเทศไทย (สไตไลซ์) — เติมสี heat ตามยอดขายรายภาค ──
function ThailandMap({ regionRevenue }: { regionRevenue: Record<string, number> }) {
  return (
    <svg width="150" height="238" viewBox="0 0 160 262" style={{ display: "block" }}>
      {Object.entries(THAI_REGION_PATHS).map(([region, d]) => (
        <path key={region} d={d} fill={tierColor(regionRevenue[region] ?? 0)} stroke="#fff" strokeWidth="1.5">
          <title>{regionDisplay(region)} · {Math.round((regionRevenue[region] ?? 0) / 1e6 * 10) / 10}M</title>
        </path>
      ))}
    </svg>
  );
}
