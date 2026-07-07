"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Trophy, UserPlus, Target,
  PhoneCall, Wallet,
  CalendarClock, FileClock, AlarmClock,
} from "lucide-react";
import {
  salesByMonth, apptTypeLabel,
  type LeadStatus, type QuotationStatus,
} from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { LineTrendChart } from "@/components/ui/Charts";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filters/FilterBar";
import { useFilters } from "@/context/FilterContext";
import { StatCard } from "@/components/ui/StatCard";
import { fmtBaht, parseBaht } from "@/lib/format";

// ── CI colors ──
const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const GREEN = "#059669";
const AMBER = "#d97706";
const RED = "#dc2626";

const MOCK_TODAY = "2026-06-30";

const monthsTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ── ตัวช่วงเวลากราฟยอดขาย: สร้างชุดข้อมูล "รายวัน" แบบคงที่ (deterministic) จาก salesByMonth ──
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysInclusive = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dmLabel = (d: Date) => `${d.getDate()} ${monthsTH[d.getMonth() + 1]}`;
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// ผู้สนใจ (lead) ไม่มีฟิลด์วันที่ใน mock → สร้างวันที่แบบคงที่ (deterministic) กระจายภายใน ~150 วันล่าสุด
// เพื่อให้ตัวกรองช่วงเวลาบนแดชบอร์ดกรอง KPI ได้จริงและผลไม่กระโดดสุ่มในแต่ละครั้ง
const leadIsoOf = (numId: number, today: Date) => isoOf(addDays(today, -(((numId * 17) % 150))));

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


export default function DealerDashboard() {
  const router = useRouter();
  // ข้อมูลสดจาก SalesContext → แดชบอร์ดอัปเดตตามที่ผู้ใช้ทำจริง (เพิ่มลีด/ดีล/ใบเสนอราคา/ปิดการขาย)
  const { leads, quotations, appointments } = useSales();
  // ตัวกรองเวลาหลัก (FilterBar/global) คุมทั้งหน้า — StatCard/กราฟ/ข้อมูล ตามตัวกรองนี้ (แบบเดียวกับ HQ)
  const { timeRange } = useFilters();

  // ─── ช่วงเวลาที่เลือก [start, end] จากตัวกรองหลัก ──
  const range = useMemo(() => ({ start: timeRange.start, end: timeRange.end }), [timeRange.start, timeRange.end]);

  // ─── ข้อมูลที่กรองตามช่วงเวลา (ลูกค้าเป้าหมาย/ใบเสนอราคา) — ตัวกรองด้านบนคุมทั้งหน้า ──
  const scoped = useMemo(() => {
    const { start, end } = range;
    const today = parseISO(MOCK_TODAY);
    const within = (iso: string) => { const d = parseISO(iso); return d >= start && d <= end; };
    return {
      fLeads: leads.filter(l => within(leadIsoOf(l.numId, today))),
      fQuotations: quotations.filter(q => within(q.date)),
    };
  }, [leads, quotations, range]);

  // ─── Derived counts — แหล่งเดียว: ลูกค้าเป้าหมาย + ใบเสนอราคา (ไม่มีระบบดีลแยกแล้ว) ──
  const m = useMemo(() => {
    const { fLeads, fQuotations } = scoped;
    const leadStatusCount = (s: LeadStatus) => fLeads.filter(l => l.status === s).length;
    const quoteStatusCount = (s: QuotationStatus) => fQuotations.filter(q => q.status === s).length;
    const activeLeads = fLeads.filter(l => l.status !== "PAID" && l.status !== "CANCELLED");
    const wonLeads = fLeads.filter(l => l.status === "PAID");
    const lostLeads = fLeads.filter(l => l.status === "CANCELLED");
    // กันนับซ้ำ: ลีดที่ปิดแล้ว + ใบเสนอราคาที่ปิดแล้วซึ่งไม่ใช่ลูกค้าของลีดเดียวกัน
    const wonCust = new Set(wonLeads.map(l => l.customerId).filter(Boolean));
    const lostCust = new Set(lostLeads.map(l => l.customerId).filter(Boolean));
    const extraWonQ = fQuotations.filter(q => q.status === "won" && !wonCust.has(q.customerId));
    const extraLostQ = fQuotations.filter(q => q.status === "lost" && !lostCust.has(q.customerId));
    const wonQByCust = new Set(fQuotations.filter(q => q.status === "won").map(q => q.customerId));
    const wonValue = extraWonQ.reduce((s, q) => s + q.totalValue, 0)
      + fQuotations.filter(q => q.status === "won" && wonCust.has(q.customerId)).reduce((s, q) => s + q.totalValue, 0)
      + wonLeads.filter(l => !wonQByCust.has(l.customerId ?? -1)).reduce((s, l) => s + parseBaht(l.value), 0);
    const wonCount = wonLeads.length + extraWonQ.length;
    return {
      leadStatusCount, wonValue,
      newLeads: leadStatusCount("WAITING"),
      activeDeals: activeLeads.length,
      quotationSent: quoteStatusCount("sent_to_client") + quoteStatusCount("viewed"),
      wonDeals: wonCount,
      lostCount: lostLeads.length + extraLostQ.length,
      expectedRevenue: activeLeads.reduce((s, l) => s + parseBaht(l.value), 0),
      leadToWon: fLeads.length ? Math.round((wonCount / fLeads.length) * 100) : 0,
    };
  }, [scoped]);

  // ─── KPI cards (4 · action-first) — คำนวณค่า+trend ตามช่วงวันของแต่ละการ์ด (real windowed data) ──
  // ค่า = ช่วง N วันล่าสุด · trend = เทียบกับ N วันก่อนหน้า (ทั้งคู่จากข้อมูลจริง)
  const statsForDays = (days: number) => {
    const today = parseISO(MOCK_TODAY);
    const cs = addDays(today, -days), ps = addDays(today, -2 * days);
    const inR = (iso: string, a: Date, b: Date) => { const d = parseISO(iso); return d > a && d <= b; };
    const lc = leads.filter(l => inR(leadIsoOf(l.numId, today), cs, today));
    const lp = leads.filter(l => inR(leadIsoOf(l.numId, today), ps, cs));
    const qc = quotations.filter(q => inR(q.date, cs, today));
    const qp = quotations.filter(q => inR(q.date, ps, cs));
    const pct = (c: number, p: number) => p > 0 ? Math.round(((c - p) / p) * 100) : (c > 0 ? 100 : 0);
    const contacted = (a: typeof leads) => a.filter(x => x.status === "WAITING").length;
    const active = (a: typeof leads) => a.filter(x => x.status !== "PAID" && x.status !== "CANCELLED").length;
    const won = (a: typeof leads) => a.filter(x => x.status === "PAID").length;
    // ยอดปิดได้ = มูลค่าใบเสนอราคาที่ปิดสำเร็จ (won) เท่านั้น — ไม่บวกลีด PAID ซ้ำ (กันนับซ้ำลูกค้าเดียวกัน)
    const rev = (q: typeof quotations) => q.filter(x => x.status === "won").reduce((s, x) => s + x.totalValue, 0);
    return {
      contacted: { value: `${contacted(lc)}`, trend: pct(contacted(lc), contacted(lp)) },
      active:    { value: `${active(lc)}`,    trend: pct(active(lc), active(lp)) },
      won:       { value: `${won(lc)}`,       trend: pct(won(lc), won(lp)) },
      revenue:   { value: fmtBaht(rev(qc)), trend: pct(rev(qc), rev(qp)) },
    };
  };
  const kpiCards: { icon: React.ReactNode; label: string; key: "contacted" | "active" | "won" | "revenue"; href: string }[] = [
    { icon: <UserPlus size={16} />, label: "ติดต่อแล้ว", key: "contacted", href: "/leads" },
    { icon: <TrendingUp size={16} />, label: "กำลังดำเนินการ", key: "active", href: "/leads" },
    { icon: <Trophy size={16} />, label: "ปิดการขายได้", key: "won", href: "/leads" },
    { icon: <Wallet size={16} />, label: "ยอดขายที่ปิดได้", key: "revenue", href: "/quotations" },
  ];

  // ─── Sales Target ────────────────────────────────────────────────
  const target = useMemo(() => {
    const TARGET = 45_000_000;
    // ใช้ยอด won ที่ dedupe แล้วจาก m (ดีล + ใบเสนอราคาที่ไม่ซ้ำลูกค้า) กันนับซ้ำ
    const actual = m.wonValue;
    const achievement = Math.round((actual / TARGET) * 100);
    return { TARGET, actual, achievement, remaining: Math.max(0, TARGET - actual), barWidth: Math.min(100, achievement) };
  }, [m]);

  // ─── Today (Goal + Follow-up) ────────────────────────────────────
  const today = useMemo(() => {
    const isDone = (s: string) => s === "done" || s === "cancelled";
    const meetingTypes = new Set(["visit", "design_meet", "presentation", "contract_sign"]);
    const callsToday = appointments.filter(a => a.type === "follow_up" && a.date === MOCK_TODAY).length;
    const meetingsToday = appointments.filter(a => meetingTypes.has(a.type) && a.date === MOCK_TODAY).length;
    const quotesExpiring = quotations.filter(q => q.expiry === MOCK_TODAY).length;
    const quotesSentToday = quotations.filter(q => q.date === MOCK_TODAY && (q.status === "sent_to_client" || q.status === "viewed" || q.status === "won")).length;
    const overdue = appointments.filter(a => a.date < MOCK_TODAY && !isDone(a.status)).length;
    // ค่าจริงจากข้อมูล (ไม่ปั้นตัวเลขขั้นต่ำ)
    const goals = [
      { label: "ติดต่อลูกค้า", done: callsToday, target: 5 },
      { label: "นัดประชุม / นำเสนอ", done: meetingsToday, target: 3 },
      { label: "ส่งใบเสนอราคา", done: quotesSentToday, target: 2 },
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
    // รายการนัดจริงของวันนี้ (เรียงตามเวลา) — ตอบ "ต้องทำอะไรวันนี้" เป็นรายการ ไม่ใช่แค่ตัวนับ
    const todayItems = appointments
      .filter(a => a.date === MOCK_TODAY && a.status === "upcoming")
      .sort((a, b) => a.time.localeCompare(b.time));
    return { goals, goalPct, follow, todayItems };
  }, [quotations, appointments]);

  // ── ดีลที่ต้องรีบดูแล — ลีดที่ยังไม่ปิดและเงียบนานสุด (เรียงตามวันเงียบ × มูลค่า) ──
  const atRisk = useMemo(() => {
    const today = parseISO(MOCK_TODAY);
    return leads
      .filter(l => l.status !== "PAID" && l.status !== "CANCELLED")
      .map(l => {
        const silent = Math.max(0, Math.round((today.getTime() - parseISO(leadIsoOf(l.numId, today)).getTime()) / 86_400_000));
        return { l, silent, value: parseBaht(l.value) };
      })
      .filter(x => x.silent >= 7)
      .sort((a, b) => (b.silent * b.value) - (a.silent * a.value))
      .slice(0, 5);
  }, [leads]);

  // หมายเหตุ: อันดับแม่แบบ (Top Products) ย้ายไปเป็นเจ้าของเดียวที่หน้ารายงาน "ยอดขายตามสินค้า"
  // เพื่อไม่ให้ Dashboard (actionable) ซ้ำกับ Reports (analytical)

  // ── ข้อมูลกราฟตามช่วงเวลาที่เลือก (อิงตัวกรองหลัก) ──
  const monthly = (arr: typeof salesByMonth) => arr.map(d => ({
    month: d.month,
    value: Math.round((d.value / 200) * 10) / 10,
    prevValue: Math.round((d.value / 200) * 0.86 * 10) / 10,
  }));
  const sales = useMemo(() => {
    switch (timeRange.preset) {
      case "thisYear":  return monthly(salesByMonth);
      case "quarter":   return monthly(salesByMonth.slice(3, 6)); // เม.ย.–มิ.ย. (ไตรมาสปัจจุบัน)
      case "last7":     return buildDailySeries(timeRange.start, timeRange.end, 7);
      case "last30":    return buildDailySeries(timeRange.start, timeRange.end, 10);
      case "thisMonth": return buildDailySeries(timeRange.start, timeRange.end, 6);
      case "custom":    return buildDailySeries(timeRange.start, timeRange.end, 12);
      default:          return monthly(salesByMonth);
    }
  }, [timeRange.preset, timeRange.start, timeRange.end]);

  // คำอธิบายช่วงเวลาที่กำลังแสดง
  const granular = (timeRange.preset === "thisYear" || timeRange.preset === "quarter") ? "รายเดือน" : "รายวัน";
  const rangeDesc = `${timeRange.subtitle} (${granular})`;

  return (
    <div className="erp section-stack">
      {/* 1 · Header */}
      <PageHeader
        title="แดชบอร์ด"
        subtitle={`ภาพรวมงานขาย · ${rangeDesc}`}
        crumbs={[{ label: "หน้าแรก", href: "/dashboard" }, { label: "แดชบอร์ด" }]}
        actions={<FilterBar dims={[]} />}
      />

      {/* 2 · KPI Row — statistics cards (icon + label + dropdown ช่วงวัน + ค่า + trend) */}
      <div className="kpi-row">
        {kpiCards.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label}
            metric={d => statsForDays(d)[c.key]}
            onClick={() => router.push(c.href)} />
        ))}
      </div>

      {/* 3 · Sales Chart 70% + Sales Target/Summary rail 30% */}
      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: "var(--space-card)", alignItems: "stretch" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div className="card-title">ยอดขายรายเดือน</div>
            <span className="pg-sub">{rangeDesc}</span>
          </div>
          <div className="card-body" style={{ flex: 1, display: "flex", alignItems: "center", paddingTop: 8 }}>
            <div style={{ width: "100%" }}><LineTrendChart key={timeRange.label} data={sales} /></div>
          </div>
        </div>

        {/* Sales Target / Summary */}
        <div className="card clickable" role="button" tabIndex={0}
          onClick={() => router.push("/leads")}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/leads"); } }}
          style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div className="card-title">เป้าหมายการขาย</div>
            <span className="badge" style={{ background: "var(--pr-lt)", color: "var(--pr)", fontWeight: 800 }}>{target.achievement}%</span>
          </div>
          <div className="card-body" style={{ flex: 1, paddingTop: 6, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <div>
              <div className="pg-sub" style={{ marginBottom: 4 }}>ยังขาดอีก</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: AMBER, lineHeight: 1 }}>{fmtBaht(target.remaining)}</div>
            </div>
            <div style={{ height: 10, background: "var(--pr-llt)", borderRadius: 999, overflow: "hidden" }}>
              <div className="bar-grow" style={{ height: "100%", width: `${target.barWidth}%`, borderRadius: 999, background: "var(--pr)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <TargetRow label="เป้าหมาย" value={fmtBaht(target.TARGET)} color={STEEL} />
              <TargetRow label="ยอดจริง" value={fmtBaht(target.actual)} color={GREEN} />
            </div>
          </div>
        </div>
      </div>

      {/* 4 · งานวันนี้ — เต็มความกว้าง (action-first: ตอบ "ต้องทำอะไรวันนี้") */}
      {/* หมายเหตุ: Sales Funnel/เส้นทางการขาย = ดูที่บอร์ด Kanban หน้าลูกค้าเป้าหมาย · ตารางล่าสุด = ดูหน้าเต็มของแต่ละเมนู (ตัดออกกันซ้ำ) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><Target size={16} color={PRIMARY} /> งานวันนี้</div>
          <span className="badge" style={{ background: "var(--pr-lt)", color: "var(--pr)", fontWeight: 800 }}>{today.goalPct}%</span>
        </div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-card)", alignItems: "start" }}>
          {/* เป้าหมายวันนี้ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {today.goals.map(g => {
              const pct = Math.min(100, Math.round((g.done / g.target) * 100));
              return (
                <div key={g.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 5 }}>
                    <span style={{ color: STEEL, fontWeight: 600 }}>{g.label}</span>
                    <span style={{ color: "var(--sub)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{g.done}/{g.target}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--pr-llt)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: pct >= 100 ? GREEN : "var(--pr)" }} />
                  </div>
                </div>
              );
            })}
            {/* นัดหมายของวันนี้ (ข้อมูลจริงจากปฏิทิน) */}
            {today.todayItems.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                {today.todayItems.map(a => (
                  <div key={a.id} role="button" tabIndex={0}
                    onClick={() => router.push("/calendar")}
                    onKeyDown={e => { if (e.key === "Enter") router.push("/calendar"); }}
                    style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: "0.72rem", borderRadius: 8, padding: "6px 8px" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--pr-llt)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <span style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.time}</span>
                    <span className="badge" style={{ background: "var(--pr-lt)", color: PRIMARY, flexShrink: 0 }}>{apptTypeLabel[a.type]}</span>
                    <span style={{ color: STEEL, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company}</span>
                    <span style={{ marginLeft: "auto", color: "var(--sub)", flexShrink: 0 }}>{a.assigned}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* ต้องติดตาม (alerts) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderLeft: "1px solid var(--border)", paddingLeft: "var(--space-card)" }}>
            {today.follow.map(f => {
              const href = f.key === "expire" ? "/quotations" : "/calendar";
              return (
                <div key={f.key} role="button" tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderRadius: 10, padding: "8px 10px", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--pr-llt)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "var(--pr-lt)", color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center" }}><f.Icon size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: STEEL, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{f.value}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--sub)" }}>{f.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5 · ลูกค้าเป้าหมายที่ต้องรีบดูแล — action-first: ลีดมูลค่าสูงที่เงียบนาน ใกล้หลุด */}
      {atRisk.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <AlarmClock size={16} color="#dc2626" /> ลูกค้าเป้าหมายที่ต้องรีบดูแล
            </div>
            <span className="badge" style={{ background: "#fee2e2", color: "#dc2626", fontWeight: 800 }}>{atRisk.length} รายเงียบนาน</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
            {atRisk.map(({ l, silent, value }) => (
              <div key={l.id} role="button" tabIndex={0}
                onClick={() => router.push(`/leads?open=${l.numId}`)}
                onKeyDown={e => { if (e.key === "Enter") router.push(`/leads?open=${l.numId}`); }}
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fff5f5"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: silent >= 30 ? "#dc2626" : silent >= 14 ? "#d97706" : "#f59e0b" }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--sub)" }}>{l.contact} · {l.assigned}</div>
                </div>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtBaht(value)}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, borderRadius: 99, padding: "3px 10px", fontSize: "0.65rem", fontWeight: 700,
                  background: silent >= 30 ? "#fee2e2" : "#fff3cd", color: silent >= 30 ? "#dc2626" : "#b45309" }}>
                  เงียบ {silent} วัน
                </span>
              </div>
            ))}
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
      <span style={{ fontSize: "0.92rem", fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
