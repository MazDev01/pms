"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Award, Target, MapPin, Trophy, Filter,
} from "lucide-react";
import {
  hqSalesByMonth, dealerLeaderboard, hqDealSummary, hqPipelineStages,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
// navy ramp สำหรับกราฟรายภาค
const RAMP = ["#003366", "#1a4f80", "#33699a", "#4d84b3", "#6699cc", "#8fb3d9"];

export default function HQDashboard() {
  const { timeRange } = useFilters();
  const f = timeRange.factor;
  const scale = (n: number) => Math.round(n * f);

  const { won, lost, negotiating, annualTarget, ytdActual } = hqDealSummary;
  const conv = won.count + lost.count ? Math.round((won.count / (won.count + lost.count)) * 100) : 0;
  const pipeVal = useMemo(() => hqPipelineStages.reduce((s, x) => s + x.valueNum, 0), []);
  const pct = Math.round((ytdActual / annualTarget) * 100);
  const totalRevenue = useMemo(() => dealerLeaderboard.reduce((s, d) => s + d.revenueActual, 0), []);

  // executive scorecard (4)
  const stats = [
    { Icon: DollarSign, label: "รายได้รวมทั้งเครือ", value: fmtBaht(scale(totalRevenue)), delta: "▲ +12.3%", tone: "success" as const, sub: `${dealerLeaderboard.length} สาขา` },
    { Icon: TrendingUp, label: "โอกาสการขายรวม", value: fmtBaht(scale(pipeVal)), delta: "▲ +6.8%", tone: "success" as const, sub: `${negotiating.count} กำลังเจรจา` },
    { Icon: Award, label: "ปิดการขาย (YTD)", value: `${scale(won.count)}`, delta: "▲ +22.1%", tone: "success" as const, sub: `เสียดีล ${lost.count}` },
    { Icon: Target, label: "อัตราปิดการขายรวม", value: `${conv}%`, delta: `เป้ารายปี ${pct}%`, tone: "muted" as const, sub: `${fmtBaht(ytdActual)} / ${fmtBaht(annualTarget)}` },
  ];

  // ข้อมูลรายเดือน (ล้านบาท) ป้อนกราฟแนวโน้ม — กราฟมีปุ่มช่วงเวลาในตัว ไม่ใช้ factor
  const trendMonthly = hqSalesByMonth.map(d => ({ month: d.month, value: Math.round(d.value * 10) / 10 }));

  // Sales funnel (ทั้งเครือ)
  const funnelMax = Math.max(...hqPipelineStages.map(s => s.count), 1);

  // Regional performance
  const regions = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    dealerLeaderboard.forEach(d => {
      const r = m.get(d.region) ?? { revenue: 0, count: 0 };
      r.revenue += d.revenueActual; r.count += 1;
      m.set(d.region, r);
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v })).sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(...arr.map(a => a.revenue), 1);
    return arr.map(a => ({ ...a, pct: Math.round((a.revenue / max) * 100) }));
  }, []);

  // Full dealer leaderboard (ranked)
  const ranked = useMemo(() =>
    [...dealerLeaderboard].sort((a, b) => b.revenueActual - a.revenueActual), []);
  const best = ranked[0];

  const winTone = (w: number) => w >= 45 ? { background: "#e5faf0", color: "#059669" }
    : w >= 35 ? { background: "#dce5f0", color: PRIMARY }
    : { background: "#fef3cd", color: "#b7892a" };

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>แดชบอร์ด HQ</h2>
          <p>ศูนย์ควบคุมเครือข่าย · สรุปภาพรวมทุกสาขาแบบเรียลไทม์ · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={["dealer", "province"]} />
      </div>

      {/* Executive scorecard */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon"><s.Icon size={18} /></div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span className="badge" style={s.tone === "success" ? { background: "#e5faf0", color: "#059669" } : { background: "#f0f4f8", color: "#6b7280" }}>{s.delta}</span>
              <span style={{ fontSize: "0.64rem", color: "var(--muted-foreground)" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1 — network revenue trend + sales funnel */}
      <div className="row-2">
        <div className="card">
          <div className="card-body">
            <SalesTrendChart title="ยอดขายรวมทั้งเครือ รายเดือน" desc="มูลค่าทุกสาขารวมกัน (ล้านบาท)" monthly={trendMonthly} />
          </div>
        </div>

        {/* Sales funnel */}
        <div className="card">
          <div className="card-header"><div><div className="card-title">Sales Funnel</div><div className="card-desc">ไปป์ไลน์ทั้งเครือ</div></div><Filter size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
            {hqPipelineStages.map((s, i) => {
              const w = 40 + (s.count / funnelMax) * 60; // 40%–100% width
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 96, fontSize: "0.73rem", fontWeight: 600, flexShrink: 0, textAlign: "right", color: "var(--muted-foreground)" }}>{s.label}</div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <div className="top5-bar" style={{ width: `${w}%`, height: 34, background: RAMP[i % RAMP.length], borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", color: "#fff" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 800 }}>{s.count}</span>
                      <span style={{ fontSize: "0.64rem", opacity: 0.85 }}>{fmtBaht(s.valueNum)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2 — regional performance + best dealer */}
      <div className="row-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">ผลงานรายภาค</div><div className="card-desc">รายได้รวมแยกตามภูมิภาค</div></div><MapPin size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 13 }}>
            {regions.map((r, i) => (
              <div key={r.region}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{r.region} <span style={{ color: "var(--muted-foreground)", fontWeight: 400, fontSize: "0.7rem" }}>· {r.count} สาขา</span></span>
                  <span style={{ fontWeight: 800, color: PRIMARY }}>{fmtBaht(r.revenue)}</span>
                </div>
                <div style={{ height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="top5-bar" style={{ height: "100%", width: `${r.pct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best dealer spotlight */}
        <div className="card">
          <div className="card-header"><div className="card-title">สาขายอดเยี่ยม</div><Trophy size={16} color="#ECC94B" /></div>
          {best && (
            <div className="card-body" style={{ paddingTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>{best.code}</div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 800 }}>{best.name.replace("Benjamin ", "")}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>ภาค{best.region} · Win rate {best.winRate}%</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "รายได้", v: fmtBaht(best.revenueActual) },
                  { k: "เป้า", v: `${Math.round((best.revenueActual / best.revenueTarget) * 100)}%` },
                  { k: "ดีลกำลังทำ", v: `${best.activeProjects}` },
                  { k: "ตรงเวลา", v: `${best.onTimePct}%` },
                ].map(m => (
                  <div key={m.k} style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--muted-foreground)" }}>{m.k}</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: PRIMARY }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full dealer leaderboard table */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div><div className="card-title">อันดับตัวแทนจำหน่าย (ทั้งเครือ)</div><div className="card-desc">จัดอันดับตามรายได้จริง</div></div>
          <Link href="/hq/dealers" className="btn btn-secondary btn-sm">จัดการสาขา →</Link>
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
                <th>สาขา</th>
                <th>ภาค</th>
                <th className="num">รายได้</th>
                <th className="num">% เป้า</th>
                <th className="num">Win Rate</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((d, i) => {
                const tpct = Math.round((d.revenueActual / d.revenueTarget) * 100);
                return (
                  <tr key={d.code} className="clickable" onClick={() => { window.location.href = "/hq/dealers"; }}>
                    <td><span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, background: i === 0 ? PRIMARY : "#f0f4f8", color: i === 0 ? "#fff" : "#6b7280" }}>{i + 1}</span></td>
                    <td style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{d.region}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{fmtBaht(d.revenueActual)}</td>
                    <td className="num">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                          <div className="bar-grow" style={{ height: "100%", width: `${Math.min(tpct, 100)}%`, background: tpct >= 80 ? "#059669" : tpct >= 50 ? PRIMARY : "#d97706", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 32 }}>{tpct}%</span>
                      </div>
                    </td>
                    <td className="num"><span className="badge" style={winTone(d.winRate)}>{d.winRate}%</span></td>
                    <td><span className="badge" style={d.status === "active" ? { background: "#e5faf0", color: "#059669" } : { background: "#f5f5f5", color: "#9ca3af" }}>{d.status === "active" ? "ใช้งาน" : "ระงับ"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
