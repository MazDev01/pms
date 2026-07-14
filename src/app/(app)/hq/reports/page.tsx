"use client";

// ─── HQ · รายงาน (Reports) ─────────────────────────────────────────────────────
// Dashboard รวมทุกส่วนในจอเดียว (แบบเดียวกับรายงาน Dealer /reports) แต่ระดับ "ทั้งเครือ"
// ทุกตัวเลขมาจาก single-source: useNetworkQuotations / useNetworkCustomers / hq_dealers_v2 / loadHQTargets / loadLostReasons
import { useState, useEffect, useMemo } from "react";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { usePersistentState } from "@/lib/usePersistentState";
import {
  mainTemplateOf, loadLostReasons, loadHQTargets,
  quotationStatusLabel, type DealerRow, type HQTargets, type QuotationStatus,
} from "@/lib/mock";
import { NET_DEALERS } from "@/lib/hqNetwork";
import { useNetworkQuotations, useNetworkCustomers } from "@/lib/useNetworkData";
import { KpiCard } from "@/components/ui/KpiCard";
import { Donut } from "@/components/ui/Charts";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { fmtBaht } from "@/lib/format";
import { exportReportPDF } from "@/lib/reportPdf";

// palette หลายสีแบบมืออาชีพ (navy หลัก + สีเสริม ไม่ฉูดฉาด)
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0ea5e9", "#65a30d"];
const TH_MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthIdx = (thai: string) => TH_MO.indexOf((thai.split(" ")[1] ?? ""));
const QUOTE_COLOR: Record<string, string> = {
  draft: "#8a94a3", sent_to_client: "#0a4f8c", viewed: "#4338ca", won: "#059669", lost: "#dc2626", expired: "#f59e0b",
};

// แถบแนวนอน (mini-bar) — รับสีได้
function BarRow({ label, valueLabel, pct, color }: { label: string; valueLabel: string; pct: number; color?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.72rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "var(--text)" }}>
          {color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}{label}
        </span>
        <span style={{ fontWeight: 800, color: "var(--pr)" }}>{valueLabel}</span>
      </div>
      <div className="mini-bar" style={{ marginTop: 0 }}>
        <div className="mini-fill bar-grow" style={{ width: `${pct}%`, background: color ?? undefined }} />
      </div>
    </div>
  );
}

export default function HQReportsPage() {
  const { timeRange, inRange } = useFilters();
  const [dealers] = usePersistentState<DealerRow[]>("hq_dealers_v3", NET_DEALERS);
  const netQuotes = useNetworkQuotations();
  const customers = useNetworkCustomers();
  const [targets, setTargets] = useState<HQTargets>(loadHQTargets);
  const [lostReasons, setLostReasons] = useState<string[]>([]);
  useEffect(() => { setTargets(loadHQTargets()); setLostReasons(loadLostReasons()); }, []);

  const quotes = useMemo(() => netQuotes.filter(q => inRange(q.createdAt)), [netQuotes, inRange]);
  const won = useMemo(() => quotes.filter(q => q.status === "won"), [quotes]);

  // ── KPI ทั้งเครือ ──
  const wonRev = won.reduce((s, q) => s + q.valueNum, 0);
  const sentRev = quotes.filter(q => q.status === "sent_to_client" || q.status === "viewed" || q.status === "won").reduce((s, q) => s + q.valueNum, 0);
  const closedN = quotes.filter(q => q.status === "won" || q.status === "lost").length;
  const winRate = closedN ? Math.round((won.length / closedN) * 100) : 0;
  const avgDeal = won.length ? Math.round(wonRev / won.length) : 0;
  const kpis = [
    { label: "ยอดขายรวมทั้งเครือ", value: fmtBaht(wonRev), icon: "dollar", current: wonRev / 1e6, target: targets.annualTarget / 1e6, targetLabel: fmtBaht(targets.annualTarget), href: "/hq/quotations" },
    { label: "ใบเสนอราคาทั้งเครือ", value: fmtBaht(sentRev), icon: "doc", current: quotes.length, target: Math.max(quotes.length, 1), targetLabel: `${quotes.length} ใบ`, href: "/hq/quotations" },
    { label: "อัตราปิดการขายเฉลี่ย", value: `${winRate}%`, icon: "target", current: winRate, target: targets.winRateTarget, targetLabel: `${targets.winRateTarget}%`, href: "/hq/pipeline" },
    { label: "มูลค่าเฉลี่ยต่อดีล", value: fmtBaht(avgDeal), icon: "award", current: avgDeal / 1e6, target: targets.avgDealSize / 1e6, targetLabel: fmtBaht(targets.avgDealSize), href: "/hq/quotations" },
  ];

  // ── แนวโน้มยอดขายรายเดือน (won ทั้งเครือ, ล้านบาท) ──
  const trendMonthly = useMemo(() => {
    const totals = Array(12).fill(0);
    won.forEach(q => { const m = monthIdx(q.createdAt); if (m >= 0) totals[m] += q.valueNum; });
    return TH_MO.map((month, i) => ({ month, value: Math.round(totals[i] / 1e6 * 10) / 10 }));
  }, [won]);

  // ── ยอดขายตามแม่แบบ (roll-up แม่แบบย่อย→หลัก) ──
  const byTemplate = useMemo(() => {
    const m = new Map<string, number>();
    won.forEach(q => { const k = mainTemplateOf(q.productLine) || "อื่น ๆ"; m.set(k, (m.get(k) ?? 0) + q.valueNum); });
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = arr.length ? arr[0][1] : 1;
    return arr.map(([label, value], i) => ({ label, value, pct: Math.round(value / max * 100), color: RAMP[i % RAMP.length] }));
  }, [won]);

  // ── ผลงานตัวแทน (จาก hq_dealers_v2 = ยอดสะสมทางการ) ──
  const dealerPerf = useMemo(() => [...dealers].sort((a, b) => b.revenueActual - a.revenueActual), [dealers]);
  const perfMax = dealerPerf.length ? dealerPerf[0].revenueActual : 1;

  // ── รายงานใบเสนอราคาตามสถานะ ──
  const quoteByStatus = useMemo(() => {
    const order: QuotationStatus[] = ["draft", "sent_to_client", "viewed", "won", "lost", "expired"];
    const rows = order.map(st => {
      const items = quotes.filter(q => q.status === st);
      return { status: st, label: quotationStatusLabel[st], count: items.length, value: items.reduce((s, q) => s + q.valueNum, 0), color: QUOTE_COLOR[st] };
    }).filter(r => r.count > 0);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 1);
    return { rows, max, total: quotes.length };
  }, [quotes]);

  // ── ยอดขายรายภาค (โดนัท จาก hq_dealers_v2) ──
  const byRegion = useMemo(() => {
    const m = new Map<string, number>();
    dealers.forEach(d => m.set(d.region, (m.get(d.region) ?? 0) + d.revenueActual));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([r, value], i) => ({ label: `ภาค${r}`, value, color: RAMP[i % RAMP.length] }));
  }, [dealers]);
  const regionTotal = byRegion.reduce((s, r) => s + r.value, 0);

  // ── จากใบเสนอราคาถึงปิดการขาย (funnel) ──
  const funnel = useMemo(() => {
    const total = quotes.length;
    const reached = quotes.filter(q => q.status !== "draft").length;
    const wonN = won.length;
    const stages = [
      { label: "ใบเสนอราคาทั้งหมด", count: total },
      { label: "ส่งถึงลูกค้าแล้ว", count: reached },
      { label: "ปิดการขายสำเร็จ", count: wonN },
    ];
    return stages.map(s => ({ ...s, pct: total ? Math.round(s.count / total * 100) : 0 }));
  }, [quotes, won]);
  const wonCount = won.length;
  const lostCount = quotes.filter(q => q.status === "lost").length;

  // ── Export CSV — รวมทุกส่วนบนหน้า ──
  function exportCsv() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = ["หมวด,รายการ,ค่า 1,ค่า 2"];
    const add = (sec: string, name: string, v1: string | number, v2: string | number = "") => lines.push([sec, name, v1, v2].map(esc).join(","));
    kpis.forEach(k => add("KPI ทั้งเครือ", k.label, k.value));
    byTemplate.forEach(p => add("ยอดขายตามแม่แบบ", p.label, fmtBaht(p.value)));
    byRegion.forEach(r => add("ยอดขายรายภาค", r.label, fmtBaht(r.value)));
    dealerPerf.forEach(d => add("ผลงานตัวแทน", d.name.replace("Benjamin ", ""), `อัตราปิด ${d.winRate}%`, fmtBaht(d.revenueActual)));
    quoteByStatus.rows.forEach(r => add("รายงานใบเสนอราคา", r.label, `${r.count} ใบ`, fmtBaht(r.value)));
    funnel.forEach(f => add("จากใบเสนอราคาถึงปิดการขาย", f.label, `${f.count} ใบ`, `${f.pct}%`));
    const csv = "﻿" + lines.join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "รายงานทั้งเครือ.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  }

  // ── Export PDF — รวมทุกส่วนของรายงาน HQ เป็นเอกสาร A4 (แบรนด์ Benjamin) ──
  const exportPDF = () => exportReportPDF("รายงานรวมทั้งเครือ", `รายงานรวมทั้งเครือ · ${timeRange.subtitle}`, [
    { heading: "สรุป KPI ทั้งเครือ", columns: ["รายการ", "ค่า"], rows: kpis.map(k => [k.label, k.value]) },
    { heading: "ยอดขายตามแม่แบบ", columns: ["แม่แบบ", "มูลค่า"], rows: byTemplate.map(p => [p.label, fmtBaht(p.value)]) },
    { heading: "ยอดขายรายภาค", columns: ["ภาค", "มูลค่า"], rows: byRegion.map(r => [r.label, fmtBaht(r.value)]) },
    { heading: "ผลงานตัวแทน", columns: ["ตัวแทน", "อัตราปิด", "มูลค่า"], rows: dealerPerf.map(d => [d.name.replace("Benjamin ", ""), `${d.winRate}%`, fmtBaht(d.revenueActual)]) },
    { heading: "รายงานใบเสนอราคา (ตามสถานะ)", columns: ["สถานะ", "จำนวน", "มูลค่า"], rows: quoteByStatus.rows.map(r => [r.label, `${r.count} ใบ`, fmtBaht(r.value)]) },
    { heading: "การวิเคราะห์การแปลง", columns: ["ขั้น", "จำนวน", "สัดส่วน"], rows: funnel.map(f => [f.label, `${f.count} ใบ`, `${f.pct}%`]) },
  ]);

  return (
    <div className="pms-dash anim-rise">
      <div className="pg-head">
        <div>
          <h1 className="pg-title">รายงาน</h1>
          <p className="pg-sub">รายงานรวมทั้งเครือ · ทุกตัวเลขจากข้อมูลจริงของตัวแทน (แหล่งเดียว) · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FilterBar dims={[]} />
          <button type="button" onClick={exportCsv} className="btn btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border,#dde3ea)", background: "var(--panel-2,#eef1f5)", color: "var(--text)", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
          <button type="button" onClick={exportPDF} className="btn btn-primary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 700, padding: "8px 14px", borderRadius: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="dg">
        {/* ซ้าย */}
        <div className="dg-l" style={{ minWidth: 0 }}>
          <div className="cc">
            <SalesTrendChart title="แนวโน้มยอดขายทั้งเครือ" desc="มูลค่าที่ปิดได้ (ล้านบาท)" monthly={trendMonthly} />
          </div>

          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ยอดขายตามแม่แบบ</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{byTemplate.length} กลุ่ม</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {byTemplate.length === 0
                ? <div style={{ fontSize: "0.8rem", color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>ไม่มีข้อมูลในช่วงเวลานี้</div>
                : byTemplate.map(p => <BarRow key={p.label} label={p.label} valueLabel={fmtBaht(p.value)} pct={p.pct} color={p.color} />)}
            </div>
          </div>

          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ผลงานตัวแทน</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{dealerPerf.length} ตัวแทน</span></div>
            <div className="table-wrap" style={{ borderTop: "none" }}>
              <table>
                <colgroup><col style={{ width: "8%" }} /><col style={{ width: "30%" }} /><col style={{ width: "16%" }} /><col style={{ width: "14%" }} /><col style={{ width: "32%" }} /></colgroup>
                <thead><tr><th></th><th>ตัวแทน</th><th>ภาค</th><th className="num">อัตราปิด</th><th className="num">มูลค่ารวม</th></tr></thead>
                <tbody>
                  {dealerPerf.map((d, i) => (
                    <tr key={d.code}>
                      <td><span style={{ width: 10, height: 10, borderRadius: 3, background: RAMP[i % RAMP.length], display: "inline-block" }} /></td>
                      <td style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</td>
                      <td style={{ color: "var(--sub)", fontSize: "0.78rem" }}>ภาค{d.region}</td>
                      <td className="num"><span className="badge" style={{ background: d.winRate >= targets.winRateTarget ? "var(--success-bg,#e5faf0)" : "#fef3cd", color: d.winRate >= targets.winRateTarget ? "var(--success,#059669)" : "#d97706" }}>{d.winRate}%</span></td>
                      <td className="num">
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                          <span style={{ fontWeight: 800 }}>{fmtBaht(d.revenueActual)}</span>
                          <div className="mini-bar" style={{ width: "100%", marginTop: 0 }}><div className="mini-fill bar-grow" style={{ width: `${Math.round(d.revenueActual / perfMax * 100)}%`, background: RAMP[i % RAMP.length] }} /></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cc">
            <div className="cc-hd"><div className="cc-title">รายงานใบเสนอราคา</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{quoteByStatus.total} ใบ</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {quoteByStatus.rows.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>ไม่มีใบเสนอราคาในช่วงเวลานี้</div>}
              {quoteByStatus.rows.map(r => (
                <div key={r.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, fontSize: "0.72rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "var(--text)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />{r.label}
                      <span style={{ fontWeight: 700, color: "var(--sub)" }}>· {r.count} ใบ</span>
                    </span>
                    <span style={{ fontWeight: 800, color: "var(--pr)" }}>{fmtBaht(r.value)}</span>
                  </div>
                  <div className="mini-bar" style={{ marginTop: 0 }}><div className="mini-fill bar-grow" style={{ width: `${Math.round(r.count / quoteByStatus.max * 100)}%`, background: r.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ขวา */}
        <div className="dg-r" style={{ minWidth: 0 }}>
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ยอดขายรายภาค</div></div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Donut segments={byRegion} centerLabel="ยอดรวม" centerValue={fmtBaht(regionTotal)} />
            </div>
            <div className="stats-legend">
              {byRegion.map(s => (
                <div key={s.label} className="sl">
                  <span className="sl-dot" style={{ background: s.color }} />
                  <span style={{ flex: 1, color: "var(--text)" }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: "var(--text)" }}>{regionTotal ? Math.round(s.value / regionTotal * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cc">
            <div className="cc-hd"><div className="cc-title">จากใบเสนอราคาถึงปิดการขาย</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{funnel.length} ขั้น</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {funnel.map((s, i) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.72rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: "var(--pr)" }}>{s.count} <span style={{ fontWeight: 700, color: "var(--sub)" }}>· {s.pct}%</span></span>
                  </div>
                  <div className="mini-bar" style={{ marginTop: 0, height: 10 }}><div className="mini-fill bar-grow" style={{ width: `${s.pct}%`, background: RAMP[i % RAMP.length] }} /></div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f4f8" }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "var(--success-bg,#e5faf0)" }}>
                <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#059669", lineHeight: 1 }}>{wonCount}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--sub)", marginTop: 4 }}>ปิดได้</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "var(--danger-bg,#fee2e2)" }}>
                <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#dc2626", lineHeight: 1 }}>{lostCount}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--sub)", marginTop: 4 }}>ปิดไม่ได้</div>
              </div>
            </div>
          </div>

          {/* ลูกค้าเด่นทั้งเครือ */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ลูกค้ามูลค่าสูงสุด</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{customers.length} ราย</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6).map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: RAMP[i % RAMP.length] + "1a", color: RAMP[i % RAMP.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: "0.66rem", color: "var(--sub)" }}>{c.dealerName} · {c.province}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: "var(--pr)", fontSize: "0.8rem", flexShrink: 0 }}>{fmtBaht(c.totalRevenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
