"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign, Award, MapPin, Trophy, Store, Users, Building2, XCircle, Percent, GitMerge,
} from "lucide-react";
import {
  dealerLeaderboard, DEFAULT_HQ_TARGETS, HQ_TARGETS_KEY, type DealerRow, type HQTargets,
} from "@/lib/mock";
import { Donut, MultiLineChart } from "@/components/ui/Charts";
import { StatCard } from "@/components/ui/StatCard";
import { FileText } from "lucide-react";
import { usePersistentState } from "@/lib/usePersistentState";
import { useFilters } from "@/context/FilterContext";
import { FilterBar, SelectFilter } from "@/components/filters/FilterBar";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { useNetworkQuotations, useNetworkCustomers } from "@/lib/useNetworkData";
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

export default function HQDashboard() {
  const router = useRouter();
  const { timeRange } = useFilters();
  // ข้อมูลตัวแทน = ชุดเดียวกับหน้า "ตัวแทน" (persist ผ่าน hq_dealers_v2) — คุณสมบัติคงที่ (ชื่อ/ภาค/เป้าทั้งปี/สถานะ)
  const [allDealers] = usePersistentState<DealerRow[]>("hq_dealers_v2", dealerLeaderboard);
  // เป้าหมายที่ HQ ตั้งไว้ (แหล่งเดียว) — ใช้เป็นเกณฑ์สี Win rate แทนการ hardcode
  const [targets] = usePersistentState<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
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
  const { leads: allNetLeads } = useSales();
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
  const hqCards: { icon: React.ReactNode; label: string; key: keyof typeof sc }[] = [
    { icon: <Store size={16} />, label: "ตัวแทนทั้งหมด", key: "dealers" },
    { icon: <Users size={16} />, label: "ลูกค้าเป้าหมายรวม", key: "leads" },
    { icon: <Building2 size={16} />, label: "ลูกค้าทั้งเครือ", key: "customers" },
    { icon: <FileText size={16} />, label: "ใบเสนอราคารวม", key: "quotes" },
    { icon: <DollarSign size={16} />, label: "ยอดขายที่ปิดได้", key: "wonVal" },
    { icon: <Trophy size={16} />, label: "ปิดการขายได้ (Won)", key: "won" },
    { icon: <XCircle size={16} />, label: "ปิดการขายไม่ได้ (Lost)", key: "lost" },
    { icon: <Percent size={16} />, label: "อัตราปิดการขาย", key: "conv" },
  ];

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

  // อันดับตัวแทน (ตามรายได้ในช่วง) + เป้าคิดตามสัดส่วนวันของช่วง
  const rankedWin = useMemo(() => dealers.map(d => {
    const st = dealerStats.get(d.code) ?? { revenue: 0, total: 0, won: 0 };
    const winRateW = st.total > 0 ? Math.round((st.won / st.total) * 100) : 0;
    const targetPeriod = Math.round(d.revenueTarget * periodDays / 365);
    const tpct = targetPeriod > 0 ? Math.round((st.revenue / targetPeriod) * 100) : 0;
    return { ...d, revenueW: st.revenue, winRateW, quotesW: st.total, wonW: st.won, tpct };
  }).sort((a, b) => b.revenueW - a.revenueW), [dealers, dealerStats, periodDays]);
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
          <h2>แดชบอร์ดสำนักงานใหญ่</h2>
          <p>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code})` : "ภาพรวมทุกตัวแทน · ทุกตัวเลขคำนวณตามช่วงเวลาที่เลือก"} · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* เลือกดูภาพรวมทั้งเครือ หรือเจาะรายตัวแทน — ตัวเลือกเฉพาะหน้านี้ (UI เดียวกับตัวกรองเวลา) */}
          <SelectFilter caption="ทุกตัวแทน (ทั้งเครือ)" value={dealerSel}
            options={allDealers.map(d => ({ value: d.code, label: `${d.code} – ${d.name}` }))}
            onChange={setDealerSel} />
          <FilterBar dims={[]} />
        </div>
      </div>

      {/* Executive scorecard — คำนวณตามช่วงเวลา · กดเพื่อดูข้อมูล */}
      <div className="stat-grid">
        {hqCards.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label} metric={() => sc[c.key]}
            onClick={() => router.push(selDealer ? `/hq/quotations?dealer=${selDealer.code}` : "/hq/quotations")} />
        ))}
      </div>

      {/* Row 1 — กราฟแนวโน้ม (2.3fr) + ตัวแทนยอดเยี่ยมเป็น rail ขวา */}
      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.75rem" }}>
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-body" style={{ paddingTop: "1.1rem", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <SalesTrendChart title={trendTitle} desc={trendDesc} monthly={trendMonthly} height={430} />
          </div>
        </div>

        {/* Best dealer spotlight — rail */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">{selDealer ? "ข้อมูลตัวแทน" : "ตัวแทนยอดเยี่ยม (ในช่วง)"}</div><Trophy size={16} color="#ECC94B" /></div>
          {best && (
            <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="clickable" role="button" tabIndex={0}
                onClick={() => router.push(`/hq/dealers/${best.code}`)}
                onKeyDown={e => { if (e.key === "Enter") router.push(`/hq/dealers/${best.code}`); }}
                title="ดูรายละเอียดตัวแทน"
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>{best.code}</div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 800 }}>{best.name.replace("Benjamin ", "")}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>ภาค{best.region} · อัตราปิดการขาย {best.winRateW}% · คลิกดูรายละเอียด →</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "รายได้ (ช่วงนี้)", v: fmtBaht(best.revenueW) },
                  { k: "% เป้า (ตามช่วง)", v: `${best.tpct}%` },
                  { k: "ใบเสนอราคา", v: `${best.quotesW}` },
                  { k: "ปิดได้", v: `${best.wonW}` },
                ].map(m => (
                  <div key={m.k} style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)" }}>{m.k}</div>
                    <div style={{ fontSize: "0.92rem", fontWeight: 800, color: PRIMARY }}>{m.v}</div>
                  </div>
                ))}
              </div>
              {/* อันดับย่อ — เติมพื้นที่ rail ให้สมดุลกับกราฟ (เฉพาะมุมมองทั้งเครือ) */}
              {rankedWin.length > 1 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {rankedWin.slice(1, 5).map((d, i) => (
                  <div key={d.code} className="clickable" role="button" tabIndex={0}
                    onClick={() => router.push(`/hq/dealers/${d.code}`)}
                    onKeyDown={e => { if (e.key === "Enter") router.push(`/hq/dealers/${d.code}`); }}
                    title="ดูรายละเอียดตัวแทน"
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", cursor: "pointer" }}>
                    <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, background: "#f0f4f8", color: "#6b7280", flexShrink: 0 }}>{i + 2}</span>
                    <span style={{ flex: 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name.replace("Benjamin ", "")}</span>
                    <span style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.revenueW)}</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — ผลงานรายภาค + อัตราปิดการขายรายตัวแทน (การ์ดแท่งกราฟคู่กัน) */}
      <div className="row-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">ผลงานรายภาค</div><div className="card-desc">รายได้ในช่วงที่เลือก แยกตามภาค</div></div><MapPin size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 13 }}>
            {regions.map((r, i) => (
              <div key={r.region}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{r.region} <span style={{ color: "var(--muted-foreground)", fontWeight: 400, fontSize: "0.72rem" }}>· {r.count} ตัวแทน</span></span>
                  <span style={{ fontWeight: 800, color: PRIMARY }}>{fmtBaht(r.revenue)}</span>
                </div>
                <div style={{ height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="top5-bar" style={{ height: "100%", width: `${r.pct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><div className="card-title">อัตราปิดการขายรายตัวแทน</div><div className="card-desc">อัตราปิดการขายในช่วงที่เลือก</div></div></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
            {rankedWin.map(d => (
              <div key={d.code}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</span>
                  <span style={{ fontWeight: 800, color: winColor(d.winRateW), fontVariantNumeric: "tabular-nums" }}>{d.winRateW}%</span>
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${d.winRateW}%`, borderRadius: 999, background: winColor(d.winRateW) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — สัดส่วนมูลค่าตามแม่แบบ (มูลค่าใบเสนอราคาในช่วง) */}
      {productAgg.length > 0 && (
      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div className="card-header"><div><div className="card-title">สัดส่วนมูลค่าตามแม่แบบ</div><div className="card-desc">มูลค่าใบเสนอราคาในช่วงที่เลือก แยกตามแม่แบบ</div></div></div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", paddingTop: 4 }}>
          <Donut
            segments={productAgg.map(p => ({ label: p.product, value: p.valueNum, color: p.color }))}
            centerLabel="มูลค่ารวม"
            centerValue={fmtBaht(productAgg.reduce((s, p) => s + p.valueNum, 0))}
            size={180}
          />
          <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 24px" }}>
            {productAgg.map(p => (
              <div key={p.product} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "0.72rem", color: "#2D2D2D" }}>{p.product}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(p.valueNum)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Row — ใบเสนอราคา เทียบ ปิดการขาย (กราฟเส้นรายเดือน) + การวิเคราะห์การแปลง (แถบ ไม่ใช่รูปกรวย) */}
      <div className="row-2" style={{ marginBottom: "1.75rem" }}>
        <div className="card">
          <div className="card-header"><div><div className="card-title">ใบเสนอราคา เทียบ ปิดการขาย</div><div className="card-desc">รายเดือน — จำนวนใบเสนอราคา เทียบ ที่ปิดได้</div></div></div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <MultiLineChart months={TH_ABBR} height={260} fmt={v => `${Math.round(v)}`}
              series={[
                { name: "ใบเสนอราคา (ใบ)", color: "#003366", data: quoteWonSeries.qC },
                { name: "ปิดการขาย (Won)", color: "#059669", data: quoteWonSeries.wC },
              ]} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div><div className="card-title">ลูกค้าเป้าหมาย เทียบ ใบเสนอราคา</div><div className="card-desc">รายเดือน — จำนวนลีด เทียบ ใบเสนอราคาที่ออก</div></div></div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <MultiLineChart months={TH_ABBR} height={260} fmt={v => `${Math.round(v)}`}
              series={[
                { name: "ลูกค้าเป้าหมาย (ราย)", color: "#003366", data: leadQuoteSeries.lC },
                { name: "ใบเสนอราคา (ใบ)", color: "#C0C0C0", data: leadQuoteSeries.qC },
              ]} />
          </div>
        </div>
      </div>

      {/* Sales Journey Pipeline — การ์ดขั้นตอนแนวนอน (ไม่ใช่ funnel/กรวย) */}
      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div className="card-header">
          <div><div className="card-title">เส้นทางการขาย (Sales Journey)</div><div className="card-desc">จำนวน · อัตราการแปลง · มูลค่า ในแต่ละขั้น</div></div>
          <GitMerge size={16} color="#9ca3af" />
        </div>
        <div className="card-body" style={{ paddingTop: 6, display: "flex", alignItems: "stretch", gap: 8, overflowX: "auto" }}>
          {journeyStages.map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 150, background: "#F7F8FA", border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, padding: "14px 14px" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--sub,#6b7280)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: PRIMARY, lineHeight: 1.2, marginTop: 4 }}>{s.count}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#28A745" }}>{s.pct}%</span>
                  <span style={{ fontSize: "0.68rem", color: "var(--sub,#6b7280)", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(s.value)}</span>
                </div>
              </div>
              {i < journeyStages.length - 1 && (
                <span style={{ color: "#C0C0C0", fontWeight: 800, flexShrink: 0 }}>›</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full dealer leaderboard table */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div><div className="card-title">{selDealer ? "สรุปตัวแทนที่เลือก" : "อันดับตัวแทน (ในช่วง)"}</div><div className="card-desc">จัดอันดับตามรายได้ในช่วงที่เลือก · % เป้าคิดตามสัดส่วนวัน</div></div>
          <Link href="/hq/dealers" className="btn btn-secondary btn-sm">จัดการตัวแทน →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>ตัวแทน</th>
                <th>ภาค</th>
                <th className="num">รายได้</th>
                <th className="num">% เป้า</th>
                <th className="num">อัตราปิด</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rankedWin.map((d, i) => (
                <tr key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)}>
                  <td><span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, background: i === 0 ? PRIMARY : "#f0f4f8", color: i === 0 ? "#fff" : "#6b7280" }}>{i + 1}</span></td>
                  <td style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{d.region}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{fmtBaht(d.revenueW)}</td>
                  <td className="num">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                        <div className="bar-grow" style={{ height: "100%", width: `${Math.min(d.tpct, 100)}%`, background: d.tpct >= 80 ? "#059669" : d.tpct >= 50 ? PRIMARY : "#d97706", borderRadius: 999 }} />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: 32 }}>{d.tpct}%</span>
                    </div>
                  </td>
                  <td className="num"><span className="badge" style={winTone(d.winRateW)}>{d.winRateW}%</span></td>
                  <td><span className="badge" style={d.status === "active" ? { background: "#e5faf0", color: "#059669" } : { background: "#f5f5f5", color: "#9ca3af" }}>{d.status === "active" ? "ใช้งาน" : "ระงับ"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
