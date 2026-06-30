"use client";

import { hqProjectSummary } from "@/lib/mock";

const DR = 46;
const DC = 2 * Math.PI * DR; // ≈ 289

export function ProjectHealthWidget() {
  const { total, inProgress, onHold, notStarted, overdue } = hqProjectSummary;

  const rows = [
    { label: "กำลังดำเนินการ", count: inProgress,  color: "#003366", bg: "#dce5f0" },
    { label: "ยังไม่เริ่ม",     count: notStarted,  color: "#94a3b8", bg: "#f0f0f5" },
    { label: "หยุดชั่วคราว",    count: onHold,      color: "#d97706", bg: "#fef3cd" },
    { label: "เกินกำหนด",       count: overdue,     color: "#dc2626", bg: "#fee2e2" },
  ];

  // Cumulative start angles for donut segments (12 o'clock = -90°)
  let cumAngle = -90;
  const segments = rows.map(r => {
    const pct = total > 0 ? r.count / total : 0;
    const startAngle = cumAngle;
    cumAngle += pct * 360;
    return { ...r, pct, startAngle };
  });

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">สุขภาพโอกาสการขาย</div>
          <div className="card-desc">รวมทุกสาขา · มิถุนายน 2026</div>
        </div>
        <span className="badge" style={{ background: "#dce5f0", color: "#003366" }}>{total} โอกาสการขายทั้งหมด</span>
      </div>

      <div className="card-body">
        {/* Donut gauge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <svg width="130" height="130" viewBox="0 0 120 120" style={{ userSelect: "none" }}>
            {/* Track */}
            <circle cx="60" cy="60" r={DR} fill="none" stroke="var(--muted)" strokeWidth="16" />

            {/* Segments — rotate each circle to its start angle; draw in left→right via stroke reveal */}
            {segments.map((s, i) =>
              s.count > 0 ? (
                <circle
                  key={i}
                  className="donut-seg"
                  cx="60" cy="60" r={DR}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="16"
                  strokeDasharray={`${DC * s.pct} ${DC}`}
                  transform={`rotate(${s.startAngle}, 60, 60)`}
                  style={{ ["--seg-len" as string]: DC * s.pct, animationDelay: `${0.15 + i * 0.18}s` }}
                />
              ) : null
            )}

            {/* Center label */}
            <g className="donut-center">
              <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2D2D2D">{total}</text>
              <text x="60" y="71" textAnchor="middle" fontSize="10" fill="#9ca3af">โอกาสการขาย</text>
            </g>
          </svg>
        </div>

        {/* Ranked rows with animated bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <div key={r.label} className="top5-row" style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 500, whiteSpace: "nowrap" }}>{r.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, color: r.color,
                      background: r.bg, borderRadius: 99, padding: "0px 6px",
                    }}>{r.count}</span>
                    <span style={{ fontSize: "0.62rem", color: "#9ca3af" }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                  <div
                    className="top5-bar"
                    style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: r.color, animationDelay: `${i * 0.08}s` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
