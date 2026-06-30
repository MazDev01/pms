"use client";

import { useState } from "react";
import {
  Download, Users, Target, CheckCircle2, Trophy, TrendingDown,
} from "lucide-react";
import {
  hqPipelineStages, hqPipelineLostReasons, hqPipelineByProduct,
  dealerLeaderboard,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

function fmtM(n: number) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : `฿${(n / 1000).toFixed(0)}K`;
}

// Color ramp: slate → light blue → blue → dark blue → navy
const STAGE_PALETTE = ["#94a3b8", "#60a5fa", "#2563eb", "#1e40af", "#003366"];

// ── Funnel ────────────────────────────────────────────────────────
function FunnelChart() {
  const maxCount = hqPipelineStages[0]?.count ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hqPipelineStages.map((stage, i) => {
        const prev      = hqPipelineStages[i - 1];
        const convRate  = prev ? Math.round((stage.count / prev.count) * 100) : null;
        const widthPct  = Math.round((stage.count / maxCount) * 100);
        const isLast    = i === hqPipelineStages.length - 1;
        const color     = STAGE_PALETTE[Math.min(i, STAGE_PALETTE.length - 1)];
        const convColor = !convRate ? "#6b7280"
          : convRate >= 70 ? "#059669"
          : convRate >= 50 ? "#f59e0b"
          : "#dc2626";

        return (
          <div key={stage.key}>
            {/* Conversion connector */}
            {convRate !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 4px 19px" }}>
                <div style={{ width: 1.5, height: 16, background: "#dde1e7", flexShrink: 0 }} />
                <span style={{
                  fontSize: "0.63rem", fontWeight: 700, color: convColor,
                  background: convColor + "18", borderRadius: 20,
                  padding: "2px 9px", border: `1px solid ${convColor}28`,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <TrendingDown size={9} color={convColor} /> {convRate}% ผ่านมา
                </span>
              </div>
            )}

            {/* Stage card */}
            <div style={{
              border: `1.5px solid ${isLast ? "#003366" : "#e5e7eb"}`,
              borderRadius: 12, padding: "13px 16px",
              background: isLast ? "#eef3f8" : "#fff",
              boxShadow: isLast ? "0 4px 16px rgba(0,51,102,.10)" : "var(--shadow-sm)",
            }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: isLast ? "#003366" : color + "20",
                    color: isLast ? "#fff" : color,
                    fontSize: "0.63rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isLast ? "#003366" : "#2D2D2D" }}>
                    {stage.label}
                  </span>
                </div>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 800,
                  color: isLast ? "#003366" : color,
                  background: (isLast ? "#003366" : color) + "15",
                  borderRadius: 8, padding: "3px 10px",
                }}>
                  {stage.count} ราย
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 7, background: "#f4f6f9", borderRadius: 99, overflow: "hidden", marginBottom: 9 }}>
                <div className="top5-bar" style={{
                  height: "100%", width: `${widthPct}%`, borderRadius: 99,
                  background: isLast ? "#003366" : color,
                }} />
              </div>

              {/* Bottom row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "0.6rem", color: "#9ca3af", marginBottom: 1 }}>มูลค่ารวม</div>
                  <div style={{ fontSize: "0.96rem", fontWeight: 800, color: isLast ? "#003366" : "#2D2D2D" }}>
                    {fmtM(stage.valueNum)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.6rem", color: "#9ca3af", marginBottom: 1 }}>เฉลี่ย/โอกาสการขาย</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280" }}>
                    {fmtM(Math.round(stage.valueNum / stage.count))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lost reasons ──────────────────────────────────────────────────
function LostReasons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hqPipelineLostReasons.map((r, i) => (
        <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            background: i === 0 ? "#fef2f2" : "#f4f6f9",
            color: i === 0 ? "#dc2626" : "#9ca3af",
            fontSize: "0.62rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "0.73rem", color: "#2D2D2D", fontWeight: 600 }}>{r.reason}</span>
              <span style={{ fontSize: "0.67rem", fontWeight: 700, color: "#dc2626", flexShrink: 0, marginLeft: 8 }}>
                {r.count} ราย
              </span>
            </div>
            <div style={{ height: 5, background: "#fef2f2", borderRadius: 99, overflow: "hidden" }}>
              <div className="top5-bar" style={{
                height: "100%", width: `${r.pct}%`,
                background: i === 0 ? "#dc2626" : "#f87171",
                opacity: 1 - i * 0.14, borderRadius: 99,
              }} />
            </div>
          </div>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", minWidth: 28, textAlign: "right" }}>
            {r.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Product breakdown ─────────────────────────────────────────────
function ProductBreakdown() {
  const total = hqPipelineByProduct.reduce((s, p) => s + p.valueNum, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hqPipelineByProduct.map(p => {
        const pct = Math.round((p.valueNum / total) * 100);
        return (
          <div key={p.product} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
              borderRadius: 6, background: p.color + "18", color: p.color,
              minWidth: 80, textAlign: "center", flexShrink: 0,
            }}>{p.product}</span>
            <div style={{ flex: 1, height: 6, background: "#f4f6f9", borderRadius: 99, overflow: "hidden" }}>
              <div className="top5-bar" style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 99 }} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D" }}>{fmtM(p.valueNum)}</div>
              <div style={{ fontSize: "0.6rem", color: "#9ca3af" }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dealer table ──────────────────────────────────────────────────
function DealerPipeline() {
  const dealers = [...dealerLeaderboard]
    .filter(d => d.status === "active")
    .sort((a, b) => b.revenueActual - a.revenueActual);
  const maxRev = Math.max(...dealers.map(d => d.revenueActual));

  function RateTag({ value, hi, lo }: { value: number; hi: number; lo: number }) {
    const color = value >= hi ? "#059669" : value >= lo ? "#f59e0b" : "#dc2626";
    const bg    = value >= hi ? "#f0fdf4" : value >= lo ? "#fffbeb" : "#fef2f2";
    return (
      <span style={{ fontSize: "0.74rem", fontWeight: 700, color, background: bg, borderRadius: 8, padding: "3px 10px" }}>
        {value}%
      </span>
    );
  }

  const RANK_STYLE = [
    { bg: "#fff3cd", color: "#d97706" },
    { bg: "#eceef0", color: "#475569" },
    { bg: "#fff3cd", color: "#92400e" },
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>สาขา</th>
            <th>ยอดขาย</th>
            <th className="num">อัตราปิดการขาย</th>
            <th className="num">โอกาสการขายที่กำลังดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {dealers.map((d, i) => {
            const revPct = Math.round((d.revenueActual / maxRev) * 100);
            const rs = RANK_STYLE[i] ?? { bg: "#f4f6f9", color: "#9ca3af" };
            return (
              <tr key={d.code}>
                <td style={{ width: 44 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: rs.bg, color: rs.color,
                    fontWeight: 800, fontSize: "0.7rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</div>
                </td>

                <td>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2D2D2D" }}>
                    {d.name.startsWith("Benjamin ") ? d.name.slice(9) : d.name}
                  </div>
                  <div style={{ fontSize: "0.63rem", color: "#9ca3af", marginTop: 1 }}>{d.region}</div>
                </td>

                <td style={{ minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: "#f4f6f9", borderRadius: 99, overflow: "hidden" }}>
                      <div className="top5-bar" style={{ height: "100%", width: `${revPct}%`, background: "#003366", borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#003366", minWidth: 52 }}>
                      {fmtM(d.revenueActual)}
                    </span>
                  </div>
                </td>

                <td className="num">
                  <RateTag value={d.winRate} hi={45} lo={30} />
                </td>
                <td className="num" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>
                  {d.activeProjects}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function SalesOverviewPage() {
  const { timeRange } = useFilters();
  const pf = timeRange.factor;

  const [toast, setToast]           = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const first = hqPipelineStages[0];
  const last  = hqPipelineStages[hqPipelineStages.length - 1];
  const overallConv = Math.round((last.count / first.count) * 100);
  const activeDealers = dealerLeaderboard.filter(d => d.status === "active").length;

  function doExport(fmt: string) {
    setShowExport(false);
    setToast(`กำลังส่งออก ${fmt}...`);
    setTimeout(() => setToast(null), 2800);
  }

  const kpis = [
    {
      label: "ผู้สนใจทั้งหมด",
      value: `${Math.round(first.count * pf).toLocaleString()} ราย`,
      sub: fmtM(Math.round(first.valueNum * pf)),
      iconClass: "kpi-navy",
      icon: <Users size={16} />,
    },
    {
      label: "ในกระบวนการ",
      value: `${Math.round(hqPipelineStages[2].count * pf).toLocaleString()} ราย`,
      sub: "ส่งใบเสนอราคาแล้ว",
      iconClass: "kpi-navy",
      icon: <Target size={16} />,
    },
    {
      label: "อัตราปิดการขาย",
      value: `${overallConv}%`,
      sub: "ผู้สนใจ → ปิดสำเร็จ",
      iconClass: overallConv >= 30 ? "kpi-green" : "kpi-amber",
      icon: <CheckCircle2 size={16} />,
    },
    {
      label: "ปิดได้ช่วงนี้",
      value: fmtM(Math.round(last.valueNum * pf)),
      sub: `${Math.round(last.count * pf)} โอกาสการขาย`,
      iconClass: "kpi-green",
      icon: <Trophy size={16} />,
    },
  ];

  const summaryStat = [
    { label: "อัตราปิดการขายรวม", value: `${overallConv}%`,                                                     color: "#003366" },
    { label: "มูลค่าโอกาสการขาย", value: fmtM(first.valueNum),                                                  color: "#2D2D2D" },
    { label: "ปิดได้เดือนนี้", value: fmtM(last.valueNum),                                                      color: "#059669" },
    { label: "รอปิด (เสนอราคาขึ้นไป)", value: fmtM(hqPipelineStages.slice(2).reduce((s, x) => s + x.valueNum, 0)), color: "#f59e0b" },
  ];

  return (
    <div className="erp">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#2D2D2D", color: "#fff",
          padding: "11px 18px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 600,
          boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <Download size={14} /> {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <h2>ภาพรวมยอดขาย</h2>
          <p>ภาพรวมยอดขายและโอกาสการขายทั้งเครือข่าย · {timeRange.subtitle}</p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <FilterBar dims={[]} />
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowExport(v => !v)}
              className="btn btn-secondary btn-md"
            >
              <Download size={14} /> ส่งออก
            </button>
            {showExport && (
              <>
                <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e5e7eb",
                  borderRadius: 10, boxShadow: "var(--shadow-md)",
                  zIndex: 101, minWidth: 158, overflow: "hidden",
                }}>
                  {["Excel (.xlsx)", "PDF รายงาน"].map(f => (
                    <button key={f} onClick={() => doExport(f)} style={{
                      width: "100%", padding: "10px 16px", textAlign: "left",
                      background: "none", border: "none", fontSize: "0.78rem",
                      color: "#2D2D2D", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#eef3f8"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <Download size={12} color="#6b7280" /> {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="kpi-bar">
        {kpis.map(k => (
          <div key={k.label} className="kpi">
            <div className={`kpi-icon ${k.iconClass}`}>{k.icon}</div>
            <div>
              <div className="kpi-val">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-label" style={{ marginTop: 2 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 16, alignItems: "start", marginBottom: 16 }}>

        {/* Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ช่องทางการขาย</div>
              <div className="card-desc">จากผู้สนใจจนถึงการปิดการขาย</div>
            </div>
          </div>
          <div className="card-body">
            <FunnelChart />

            {/* Summary strip */}
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: "1px solid #e5e7eb",
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            }}>
              {summaryStat.map((s, si) => (
                <div key={s.label} style={{
                  textAlign: "center", padding: "0 8px",
                  borderRight: si < 3 ? "1px solid #e5e7eb" : "none",
                }}>
                  <div style={{ fontSize: "0.59rem", color: "#9ca3af", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
            </div>
            <div className="card-body"><LostReasons /></div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">แยกตามสินค้า / บริการ</div>
            </div>
            <div className="card-body"><ProductBreakdown /></div>
          </div>
        </div>
      </div>

      {/* ── Dealer table ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">ผลงานต่อสาขา</div>
            <div className="card-desc">ยอดขาย · อัตราปิดการขาย · โอกาสการขายที่กำลังดำเนินการ</div>
          </div>
          <span className="badge" style={{ background: "#f4f6f9", color: "#6b7280" }}>
            {activeDealers} สาขา
          </span>
        </div>
        <DealerPipeline />
      </div>
    </div>
  );
}
