"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Send, Trophy, UserPlus, XCircle, Target,
  PhoneCall, Eye, Wallet, ArrowRight,
  CalendarClock, FileClock, AlarmClock,
  CalendarDays, ChevronDown, Check,
} from "lucide-react";
import {
  salesByMonth, leadStatusLabel, leadStatusColor,
  quotationStatusLabel, quotationStatusColor,
  solutionProducts,
  type LeadStatus, type QuotationStatus,
} from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { AreaChart } from "@/components/ui/Charts";
import { fmtBaht } from "@/lib/format";

// ── CI colors ──
const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const GREEN = "#059669";
const AMBER = "#d97706";
const RED = "#dc2626";

const MOCK_TODAY = "2026-06-30";

const monthsTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmtDate = (iso: string) => { const [, mm, dd] = iso.split("-"); return `${parseInt(dd)} ${monthsTH[parseInt(mm)]}`; };

// ── ตัวช่วงเวลากราฟยอดขาย: สร้างชุดข้อมูล "รายวัน" แบบคงที่ (deterministic) จาก salesByMonth ──
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysInclusive = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dmLabel = (d: Date) => `${d.getDate()} ${monthsTH[d.getMonth() + 1]}`;

// ยอดขายต่อวัน (ล้านบาท) — เฉลี่ยจากยอดเดือน + คลื่นในเดือนเพื่อให้เส้นดูเป็นธรรมชาติ
function dayMillions(d: Date): number {
  const m = d.getMonth();
  const monthVal = salesByMonth[m]?.value ?? salesByMonth[m % salesByMonth.length].value;
  const dim = new Date(d.getFullYear(), m + 1, 0).getDate();
  const base = monthVal / 200 / dim;
  const wave = 1 + 0.4 * Math.sin(d.getDate() * 0.7 + m);
  return Math.max(base * wave, base * 0.2);
}

// สร้างจุดกราฟจากช่วงวัน โดยรวมเป็น bucket ให้จำนวนจุด ≤ maxPoints
function buildDailySeries(start: Date, end: Date, maxPoints: number) {
  const total = Math.max(1, daysInclusive(start, end));
  const bucket = Math.max(1, Math.ceil(total / maxPoints));
  const pts: { month: string; value: number; prevValue: number }[] = [];
  for (let i = 0; i < total; i += bucket) {
    let sum = 0;
    for (let j = 0; j < bucket && i + j < total; j++) sum += dayMillions(addDays(start, i + j));
    const value = Math.round(sum * 10) / 10;
    pts.push({ month: dmLabel(addDays(start, i)), value, prevValue: Math.round(value * 0.86 * 10) / 10 });
  }
  return pts;
}

// light tint per accent (for KPI icon chips)
const TINT: Record<string, string> = { [PRIMARY]: "#dce5f0", [GREEN]: "#e5faf0", [AMBER]: "#fff3cd", [RED]: "#fee2e2" };

const RANGE_OPTS: { key: string; label: string }[] = [
  { key: "7d", label: "7 วันล่าสุด" },
  { key: "30d", label: "30 วันล่าสุด" },
  { key: "month", label: "เดือนนี้" },
  { key: "quarter", label: "ไตรมาส" },
  { key: "year", label: "ปีนี้" },
];

export default function DealerDashboard() {
  const router = useRouter();
  // ข้อมูลสดจาก SalesContext → แดชบอร์ดอัปเดตตามที่ผู้ใช้ทำจริง (เพิ่มลีด/ดีล/ใบเสนอราคา/ปิดการขาย)
  const { leads, quotations, deals, appointments } = useSales();
  // เริ่มที่ "ปีนี้" (รายเดือน) ให้สเกลตรงกับหัวข้อ "ยอดขายรายเดือน" และ KPI สรุปยอดขาย — 7 วัน/30 วัน เป็นมุมมองย่อยที่เลือกดูเพิ่มได้
  const [chartRange, setChartRange] = useState("year");
  const [customStart, setCustomStart] = useState("2026-06-01");
  const [customEnd, setCustomEnd] = useState("2026-06-30");

  // ─── Derived counts ──────────────────────────────────────────────
  const m = useMemo(() => {
    const leadStatusCount = (s: LeadStatus) => leads.filter(l => l.status === s).length;
    const quoteStatusCount = (s: QuotationStatus) => quotations.filter(q => q.status === s).length;
    const active = deals.filter(d => d.outcome === "active");
    const won = deals.filter(d => d.outcome === "won");
    const lostDeals = deals.filter(d => d.outcome === "lost");
    const lostQ = quotations.filter(q => q.status === "lost");
    const wonValue = won.reduce((s, d) => s + d.value, 0);
    return {
      leadStatusCount, active, won, wonValue,
      newLeads: leadStatusCount("NEW"),
      activeDeals: active.length,
      quotationSent: quoteStatusCount("sent_to_client") + quoteStatusCount("viewed"),
      wonDeals: won.length + quoteStatusCount("won"),
      lostCount: lostDeals.length + lostQ.length,
      expectedRevenue: active.reduce((s, d) => s + d.value, 0),
      avgDealSize: won.length ? Math.round(wonValue / won.length) : 0,
      leadToWon: leads.length ? Math.round((won.length / leads.length) * 100) : 0,
    };
  }, [leads, quotations, deals]);

  // ─── KPI cards (2 rows × 3) ──────────────────────────────────────
  const kpis = [
    { Icon: UserPlus, label: "ลีดใหม่", en: "New Leads", value: `${m.newLeads}`, accent: PRIMARY, href: "/leads" },
    { Icon: TrendingUp, label: "ดีลที่กำลังดำเนินการ", en: "Active Deals", value: `${m.activeDeals}`, accent: PRIMARY, href: "/pipeline" },
    { Icon: Send, label: "ใบเสนอราคาที่ส่ง", en: "Quotation Sent", value: `${m.quotationSent}`, accent: AMBER, href: "/quotations" },
    { Icon: Trophy, label: "ปิดการขายได้", en: "Won Deals", value: `${m.wonDeals}`, accent: GREEN, href: "/pipeline" },
    { Icon: XCircle, label: "เสียโอกาส", en: "Lost Deals", value: `${m.lostCount}`, accent: RED, href: "/pipeline" },
    { Icon: Wallet, label: "มูลค่าคาดการณ์", en: "Expected Revenue", value: fmtBaht(m.expectedRevenue), accent: PRIMARY, href: "/pipeline" },
  ];

  // ─── Sales Target ────────────────────────────────────────────────
  const target = useMemo(() => {
    const TARGET = 45_000_000;
    const actual = deals.filter(d => d.outcome === "won").reduce((s, d) => s + d.value, 0)
      + quotations.filter(q => q.status === "won").reduce((s, q) => s + q.totalValue, 0);
    const achievement = Math.round((actual / TARGET) * 100);
    return { TARGET, actual, achievement, remaining: Math.max(0, TARGET - actual), barWidth: Math.min(100, achievement) };
  }, [deals, quotations]);

  // ─── Today (Goal + Follow-up) ────────────────────────────────────
  const today = useMemo(() => {
    const isDone = (s: string) => s === "done" || s === "cancelled";
    const meetingTypes = new Set(["visit", "design_meet", "presentation", "contract_sign"]);
    const callsToday = appointments.filter(a => a.type === "follow_up" && a.date === MOCK_TODAY).length;
    const meetingsToday = appointments.filter(a => meetingTypes.has(a.type) && a.date === MOCK_TODAY).length;
    const quotesExpiring = quotations.filter(q => q.expiry === MOCK_TODAY).length;
    const overdue = appointments.filter(a => a.date < MOCK_TODAY && !isDone(a.status)).length;
    const goals = [
      { label: "ติดต่อลูกค้า", done: Math.max(callsToday, 3), target: 5 },
      { label: "นัดประชุม / นำเสนอ", done: Math.max(meetingsToday, 1), target: 3 },
      { label: "ส่งใบเสนอราคา", done: 1, target: 2 },
    ];
    const totalDone = goals.reduce((s, g) => s + Math.min(g.done, g.target), 0);
    const totalTarget = goals.reduce((s, g) => s + g.target, 0);
    const goalPct = Math.round((totalDone / totalTarget) * 100);
    const follow = [
      { key: "calls", Icon: PhoneCall, label: "โทร", value: callsToday, color: PRIMARY },
      { key: "meet", Icon: CalendarClock, label: "ประชุม", value: meetingsToday, color: "#002244" },
      { key: "expire", Icon: FileClock, label: "หมดอายุ", value: quotesExpiring, color: AMBER },
      { key: "overdue", Icon: AlarmClock, label: "เกินกำหนด", value: overdue, color: RED },
    ];
    return { goals, goalPct, follow };
  }, [quotations, appointments]);

  // ─── Top Products (mini ranking) ─────────────────────────────────
  // สินค้าขายดี — อ้างอิง 6 แม่แบบจริง (จับจากลีด/ใบเสนอราคา/ดีล ที่ตรงชื่อแม่แบบ) ไม่มีการสุ่ม
  const topProducts = useMemo(() => {
    const PALETTE = [PRIMARY, GREEN, AMBER, "#0369a1", "#7c3aed", "#dc2626"];
    const parseVal = (v: string) => {
      const n = parseFloat(v.replace(/[฿,\s]/g, "")) || 0;
      if (/M/i.test(v)) return n * 1e6;
      if (/K/i.test(v)) return n * 1e3;
      return n;
    };
    const rows = solutionProducts.map((tpl, i) => {
      const name = tpl.name;
      let count = 0, value = 0;
      leads.forEach(l => { if (l.product === name) { count++; value += parseVal(l.value); } });
      quotations.forEach(q => { if (`${q.project} ${q.buildingType}`.includes(name)) { count++; value += q.totalValue; } });
      deals.forEach(d => { if (d.project.includes(name)) { count++; value += d.value; } });
      return { key: name, color: PALETTE[i % PALETTE.length], count, value };
    });
    return rows.filter(r => r.count > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [leads, quotations, deals]);

  const recentLeads = useMemo(() => [...leads].sort((a, b) => b.numId - a.numId).slice(0, 5), [leads]);
  const activeQuotations = useMemo(
    () => quotations.filter(q => q.status === "draft" || q.status === "sent_to_client" || q.status === "viewed")
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [quotations]
  );

  // ── ข้อมูลกราฟตามช่วงเวลาที่เลือก (อิงวันจริง; วันนี้จำลอง = 30 มิ.ย. 2026) ──
  const TODAY = useMemo(() => parseISO(MOCK_TODAY), []);
  const monthly = (arr: typeof salesByMonth) => arr.map(d => ({
    month: d.month,
    value: Math.round((d.value / 200) * 10) / 10,
    prevValue: Math.round((d.value / 200) * 0.86 * 10) / 10,
  }));
  const sales = useMemo(() => {
    switch (chartRange) {
      case "year": return monthly(salesByMonth);
      case "quarter": return monthly(salesByMonth.slice(3, 6)); // เม.ย.–มิ.ย. (ไตรมาสปัจจุบัน)
      case "7d": return buildDailySeries(addDays(TODAY, -6), TODAY, 7);
      case "30d": return buildDailySeries(addDays(TODAY, -29), TODAY, 10);
      case "month": return buildDailySeries(new Date(2026, 5, 1), new Date(2026, 5, 30), 6);
      case "custom": {
        let s = parseISO(customStart), e = parseISO(customEnd);
        if (e < s) [s, e] = [e, s];
        return buildDailySeries(s, e, 12);
      }
      default: return monthly(salesByMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRange, customStart, customEnd, TODAY]);

  // คำอธิบายช่วงเวลาที่กำลังแสดง
  const rangeDesc = useMemo(() => {
    if (chartRange === "custom") return `${fmtDate(customStart)} – ${fmtDate(customEnd)}`;
    if (chartRange === "year") return "ทั้งปี (รายเดือน)";
    if (chartRange === "quarter") return "ไตรมาสปัจจุบัน (รายเดือน)";
    if (chartRange === "month") return "เดือนนี้ (รายวัน)";
    if (chartRange === "7d") return `${fmtDate("2026-06-24")} – ${fmtDate(MOCK_TODAY)} (รายวัน)`;
    return `${fmtDate("2026-06-01")} – ${fmtDate(MOCK_TODAY)} (รายวัน)`;
  }, [chartRange, customStart, customEnd]);

  return (
    <div className="erp" style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
      {/* Header */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>แดชบอร์ด</h2>
          <p>ภาพรวมงานขายและโอกาสการขาย</p>
        </div>
        <ChartRangePicker
          value={chartRange} onChange={setChartRange}
          customStart={customStart} customEnd={customEnd}
          setCustomStart={setCustomStart} setCustomEnd={setCustomEnd}
        />
      </div>

      {/* ── KPI: 2 rows × 3 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1.1rem" }}>
        {kpis.map(k => (
          <div key={k.label} className="card" role="button" tabIndex={0}
            onClick={() => router.push(k.href)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(k.href); } }}
            style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: STEEL }}>{k.label}</div>
              </div>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: TINT[k.accent] ?? "#dce5f0", color: k.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.Icon size={20} />
              </span>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: k.accent, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Hero: Monthly Chart (focal) + Today (Goal + Follow-up) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: "1.4rem", alignItems: "stretch" }}>
        {/* Monthly Sales Chart — จุดเด่นของหน้า */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div>
              <div className="card-title">ยอดขายรายเดือน</div>
              <div className="card-desc">แนวโน้มยอดขายเทียบช่วงก่อนหน้า (ล้านบาท) · {rangeDesc}</div>
            </div>
          </div>
          <div className="card-body" style={{ flex: 1, display: "flex", alignItems: "center", paddingTop: 8 }}>
            <div style={{ width: "100%" }}><AreaChart key={`${chartRange}-${customStart}-${customEnd}`} data={sales} /></div>
          </div>
        </div>

        {/* Today card */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><Target size={16} color={PRIMARY} /> เป้าหมายวันนี้</div>
              <div className="card-desc">Today's Goal · {fmtDate(MOCK_TODAY)}</div>
            </div>
            <span className="badge" style={{ background: TINT[PRIMARY], color: PRIMARY, fontWeight: 800 }}>{today.goalPct}%</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 13 }}>
            {today.goals.map(g => {
              const pct = Math.min(100, Math.round((g.done / g.target) * 100));
              return (
                <div key={g.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: 5 }}>
                    <span style={{ color: STEEL, fontWeight: 600 }}>{g.label}</span>
                    <span style={{ color: "var(--muted-foreground)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{g.done}/{g.target}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: pct >= 100 ? GREEN : `linear-gradient(90deg, ${PRIMARY}, #1e6fbf)` }} />
                  </div>
                </div>
              );
            })}
            {/* follow-up mini (2×2) */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {today.follow.map(f => {
                const href = f.key === "expire" ? "/quotations" : "/calendar";
                return (
                <div key={f.key} role="button" tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
                  style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", borderRadius: 8, padding: "2px 4px" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,51,102,.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "var(--muted)", color: f.color, display: "flex", alignItems: "center", justifyContent: "center" }}><f.Icon size={15} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: f.color, lineHeight: 1 }}>{f.value}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>{f.label}</div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Compact row: Sales Target · Top Products ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1.4rem", alignItems: "stretch" }}>
        {/* Sales Target — คลิกไปดูดีลที่ปิดการขาย (ที่มาของยอดจริง) */}
        <div className="card" role="button" tabIndex={0}
          onClick={() => router.push("/pipeline")}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/pipeline"); } }}
          style={{ cursor: "pointer" }}>
          <div className="card-header">
            <div><div className="card-title">เป้าหมายการขาย</div><div className="card-desc">เทียบเป้าหมายรายปี · คลิกดูที่มา</div></div>
            <span className="badge" style={{ background: TINT[PRIMARY], color: PRIMARY, fontWeight: 800 }}>{target.achievement}%</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TargetRow label="เป้าหมาย" value={fmtBaht(target.TARGET)} color={STEEL} />
              <TargetRow label="ยอดจริง" value={fmtBaht(target.actual)} color={GREEN} />
              <TargetRow label="คงเหลือ" value={fmtBaht(target.remaining)} color={AMBER} />
            </div>
            <div style={{ height: 12, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
              <div className="bar-grow" style={{ height: "100%", width: `${target.barWidth}%`, borderRadius: 999, background: `linear-gradient(90deg, ${PRIMARY}, #1e6fbf)` }} />
            </div>
          </div>
        </div>

        {/* Top Products — mini ranking (แม่แบบยอดนิยม · คลิกดูที่มา) */}
        <div className="card">
          <div className="card-header"><div><div className="card-title">แม่แบบยอดนิยม</div><div className="card-desc">อันดับตามมูลค่ารวม · คลิกเพื่อดูรายการ</div></div></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
            {topProducts.length === 0 && (
              <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", padding: "16px 0", textAlign: "center" }}>ยังไม่มีข้อมูลแม่แบบ</div>
            )}
            {topProducts.map((p, i) => (
              <div key={p.key} role="button" tabIndex={0}
                onClick={() => router.push("/leads")}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/leads"); } }}
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderRadius: 8, padding: "2px 4px", transition: "background .12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,51,102,.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.78rem", color: i === 0 ? "#fff" : "var(--muted-foreground)", background: i === 0 ? PRIMARY : "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 800, color: p.color, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.key}</div>
                  <div style={{ fontSize: "0.64rem", color: "var(--muted-foreground)" }}>{p.count} รายการ</div>
                </div>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: STEEL, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Leads (5) + Active Quotations (5) ── */}
      <div className="row-2-eq">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header">
            <div><div className="card-title">ลีดล่าสุด</div><div className="card-desc">5 รายการล่าสุด</div></div>
            <Link href="/leads" className="btn btn-ghost btn-sm">ดูทั้งหมด <ArrowRight size={13} /></Link>
          </div>
          <div className="table-wrap">
            <table>
              <colgroup><col style={{ width: "22%" }} /><col style={{ width: "22%" }} /><col style={{ width: "27%" }} /><col style={{ width: "21%" }} /><col style={{ width: "8%" }} /></colgroup>
              <thead><tr><th>ชื่อผู้สนใจ</th><th>บริษัท</th><th>ขั้นตอน</th><th>ผู้รับผิดชอบ</th><th style={{ textAlign: "center" }}>ดู</th></tr></thead>
              <tbody>
                {recentLeads.map(l => {
                  const c = leadStatusColor[l.status];
                  return (
                    <tr key={l.id}>
                      <td title={l.name} style={{ fontWeight: 600 }}>{l.name}</td>
                      <td title={l.company} style={{ color: "var(--muted-foreground)" }}>{l.company}</td>
                      <td><span className="badge" style={{ background: c.bg, color: c.text }}>{leadStatusLabel[l.status]}</span></td>
                      <td title={l.assigned} style={{ color: "var(--muted-foreground)" }}>{l.assigned}</td>
                      <td style={{ textAlign: "center", overflow: "visible" }}><Link href={`/leads/${l.numId}`} className="btn btn-ghost btn-sm" style={{ padding: 6 }} aria-label="ดูลีด"><Eye size={15} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header">
            <div><div className="card-title">ใบเสนอราคาที่กำลังดำเนินการ</div><div className="card-desc">5 รายการล่าสุด</div></div>
            <Link href="/quotations" className="btn btn-ghost btn-sm">ดูทั้งหมด <ArrowRight size={13} /></Link>
          </div>
          <div className="table-wrap">
            <table>
              <colgroup><col style={{ width: "22%" }} /><col style={{ width: "30%" }} /><col style={{ width: "20%" }} /><col style={{ width: "18%" }} /><col style={{ width: "10%" }} /></colgroup>
              <thead><tr><th>เลขที่</th><th>ลูกค้า</th><th className="num">มูลค่า</th><th>สถานะ</th><th style={{ textAlign: "center" }}>ดู</th></tr></thead>
              <tbody>
                {activeQuotations.map(q => {
                  const c = quotationStatusColor[q.status];
                  return (
                    <tr key={q.id}>
                      <td title={q.id} style={{ fontWeight: 600 }}>{q.id}</td>
                      <td title={q.customer} style={{ color: "var(--muted-foreground)" }}>{q.customer}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmtBaht(q.totalValue)}</td>
                      <td><span className="badge" style={{ background: c.bg, color: c.text }}>{quotationStatusLabel[q.status]}</span></td>
                      <td style={{ textAlign: "center", overflow: "visible" }}><Link href="/quotations" className="btn btn-ghost btn-sm" style={{ padding: 6 }} aria-label="ดูใบเสนอราคา"><Eye size={15} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── ตัวเลือกช่วงเวลาแบบ dropdown (ระดับหน้า) — ใช้สไตล์ชิปเดียวกับ FilterBar ──
function ChartRangePicker({
  value, onChange, customStart, customEnd, setCustomStart, setCustomEnd,
}: {
  value: string; onChange: (v: string) => void;
  customStart: string; customEnd: string;
  setCustomStart: (v: string) => void; setCustomEnd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowCustom(false); }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const label = value === "custom"
    ? "กำหนดเอง"
    : (RANGE_OPTS.find(o => o.key === value)?.label ?? "ช่วงเวลา");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)}
        style={{ gap: 6, background: "var(--accent)", borderColor: "var(--primary)", color: "var(--primary)" }}>
        <CalendarDays size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
        <ChevronDown size={13} style={{ opacity: 0.55, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, minWidth: 240, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
          <div style={{ padding: "6px 0" }}>
            {RANGE_OPTS.map(o => {
              const sel = value === o.key;
              return (
                <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px",
                    background: sel ? "var(--accent)" : "transparent", border: "none", cursor: "pointer",
                    textAlign: "left", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: sel ? 700 : 400,
                    color: sel ? "var(--primary)" : "var(--color-sub, #2D2D2D)",
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#f8f9fb"; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <Check size={13} style={{ color: sel ? "var(--primary)" : "transparent", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", padding: "6px 10px 10px" }}>
            <button onClick={() => setShowCustom(s => !s)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                padding: "6px 3px", fontSize: "0.76rem", fontWeight: 600,
                color: value === "custom" ? "var(--primary)" : STEEL,
              }}>
              <span>กำหนดช่วงเอง</span>
              <ChevronDown size={13} style={{ opacity: 0.55, transform: showCustom ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {showCustom && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 5 }}>
                <input type="date" className="form-input" value={customStart} min="2026-01-01" max="2026-12-31"
                  onChange={e => setCustomStart(e.target.value)} />
                <input type="date" className="form-input" value={customEnd} min="2026-01-01" max="2026-12-31"
                  onChange={e => setCustomEnd(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={() => { onChange("custom"); setOpen(false); setShowCustom(false); }}
                  style={{ justifyContent: "center" }}>
                  ใช้ช่วงเวลานี้
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sales-target compact row ──
function TargetRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: "0.95rem", fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
