"use client";

import { hqServiceLineRevenue } from "@/lib/mock";

export function ServiceLineWidget() {
  const max = Math.max(...hqServiceLineRevenue.map((r) => r.value));
  const totalValue = hqServiceLineRevenue.reduce((s, r) => s + r.value, 0);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">รายได้ตามสายบริการ</div>
          <div className="card-desc">
            รวม <strong style={{ color: "#003366" }}>฿{(totalValue / 1_000_000).toFixed(1)}M</strong>
          </div>
        </div>
        <span className="badge" style={{ background: "#dce5f0", color: "#003366" }}>YTD 2026</span>
      </div>

      <div className="card-body">
        {hqServiceLineRevenue.map((r, i) => {
          const barPct = Math.round((r.value / max) * 100);
          const sharePct = Math.round((r.value / totalValue) * 100);
          const label = `฿${(r.value / 1_000_000).toFixed(1)}M`;
          return (
            <div
              key={r.line}
              className="top5-row"
              style={{ marginBottom: 12, animationDelay: `${i * 0.08}s` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block", marginTop: 1 }} />
                  <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#2D2D2D" }}>{r.line}</span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D" }}>{label}</div>
                  <div style={{ fontSize: "0.62rem", color: "#9ca3af", marginTop: 1 }}>{sharePct}% ของรายได้รวม</div>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                <div
                  className="top5-bar"
                  style={{ height: "100%", width: `${barPct}%`, borderRadius: 999, background: r.color, animationDelay: `${i * 0.08}s` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
