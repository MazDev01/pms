"use client";

import {
  Target, TrendingUp, Award, Building2, DollarSign, Clock,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  target: Target,
  trending: TrendingUp,
  award: Award,
  building: Building2,
  dollar: DollarSign,
  clock: Clock,
};

type KpiCardProps = {
  label: string;
  value: string;
  delta: number;
  icon: string;
  sub?: string;
  currentNum?: number;
  targetNum?: number;
  targetLabel?: string;
};

export function KpiCard({ label, value, delta, icon, sub, currentNum, targetNum, targetLabel }: KpiCardProps) {
  const Icon = iconMap[icon] ?? TrendingUp;
  const positive = delta >= 0;

  const pct = (currentNum !== undefined && targetNum && targetNum > 0)
    ? Math.min(100, Math.round((currentNum / targetNum) * 100))
    : null;

  const barColor = pct === null ? "#003366"
    : pct >= 80 ? "#059669"
    : pct >= 50 ? "#003366"
    : pct >= 30 ? "#d97706"
    : "#dc2626";

  return (
    <div className="stat-card">
      {/* Icon tile + label/value */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <div className="stat-icon">
          <Icon size={20} />
        </div>
      </div>

      {/* Delta */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: pct !== null ? 4 : 0 }}>
        <span className={`stat-delta ${positive ? "delta-up" : "delta-down"}`}>
          {positive ? "▲" : "▼"} {Math.abs(delta)}%
        </span>
        {sub && <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>{sub}</span>}
      </div>

      {/* Target progress bar */}
      {pct !== null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "0.6rem", color: "var(--muted-foreground)" }}>เป้า {targetLabel}</span>
            <span style={{ fontSize: "0.63rem", fontWeight: 700, color: barColor }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
            <div className="top5-bar" style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: barColor }} />
          </div>
        </div>
      )}
    </div>
  );
}
