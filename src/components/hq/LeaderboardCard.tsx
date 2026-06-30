"use client";

import Link from "next/link";
import { dealerLeaderboard } from "@/lib/mock";
import { TrendingUp, Trophy, AlertTriangle, AlertCircle } from "lucide-react";

export function LeaderboardCard() {
  const ranked = [...dealerLeaderboard]
    .filter(d => d.status === "active")
    .sort((a, b) => b.revenueActual - a.revenueActual);

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={15} color="#ECC94B" strokeWidth={2} /> อันดับสาขา
          </div>
          <div className="card-desc">เดือนมิถุนายน 2026</div>
        </div>
        <Link href="/hq/dealers" style={{ fontSize: "0.72rem", color: "#003366", fontWeight: 600, textDecoration: "none" }}>ดูทั้งหมด →</Link>
      </div>

      {/* List */}
      <div className="card-body" style={{ paddingTop: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {ranked.map((d, i) => {
            const targetPct = d.revenueTarget > 0 ? Math.min(100, Math.round(d.revenueActual / d.revenueTarget * 100)) : 0;
            const revenueLabel = `฿${(d.revenueActual / 1_000_000).toFixed(1)}M`;

            const isAtRisk = targetPct < 50;
            const isWarn   = targetPct >= 50 && targetPct < 70;
            const barColor = isAtRisk ? "#dc2626" : isWarn ? "#ECC94B" : "#003366";
            const pctColor = isAtRisk ? "#dc2626" : isWarn ? "#2D2D2D" : "#2D2D2D";

            const branchName = d.name.startsWith("Benjamin ") ? d.name.slice(9) : d.name;

            return (
              <div key={d.code} className="top5-row" style={{ animationDelay: `${i * 0.12}s` }}>
                {/* Label / value row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--muted)", color: "#6b7280", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.66rem", fontWeight: 800, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#2D2D2D", fontWeight: 700 }}>
                    {branchName}
                    <span style={{ color: "#6b7280", fontWeight: 400 }}> · {d.region} · {d.activeProjects} โอกาสการขาย</span>
                    {isAtRisk && <AlertCircle size={11} color="#dc2626" strokeWidth={2.5} style={{ marginLeft: 4, verticalAlign: "-1px" }} />}
                    {isWarn && <AlertTriangle size={11} color="#d97706" strokeWidth={2.5} style={{ marginLeft: 4, verticalAlign: "-1px" }} />}
                  </span>
                  <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                    <span style={{ fontWeight: 800, color: "#2D2D2D" }}>{revenueLabel}</span>
                    <span style={{ fontSize: "0.62rem", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <TrendingUp size={9} /> {d.winRate}% ปิดการขาย
                    </span>
                  </span>
                </div>

                {/* Track + bar (% ต่อเป้า) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${targetPct}%`, borderRadius: 999, background: barColor, animationDelay: `${i * 0.12}s` }} />
                  </div>
                  <span style={{ fontSize: "0.66rem", fontWeight: 800, color: pctColor, flexShrink: 0, width: 38, textAlign: "right" }}>{targetPct}% เป้า</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
