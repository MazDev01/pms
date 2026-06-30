"use client";

import { Fragment } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Clock, Target } from "lucide-react";
import { hqDealSummary } from "@/lib/mock";

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

export function DealSummaryStrip() {
  const { won, lost, negotiating, annualTarget, ytdActual } = hqDealSummary;
  const pct = Math.round((ytdActual / annualTarget) * 100);

  const metrics = [
    {
      href: "/reports",
      Icon: TrendingUp,
      label: "ปิดการขายแล้ว",
      value: `฿${fmt(won.value)}`,
      sub: `${won.count} โอกาสการขาย`,
      valueColor: "#059669",
    },
    {
      href: "/reports",
      Icon: TrendingDown,
      label: "เสียไป",
      value: `฿${fmt(lost.value)}`,
      sub: `${lost.count} โอกาสการขาย`,
      valueColor: "#dc2626",
    },
    {
      href: "/reports",
      Icon: Clock,
      label: "กำลังเจรจา",
      value: `฿${fmt(negotiating.value)}`,
      sub: `${negotiating.count} โอกาสการขาย`,
      valueColor: "#2D2D2D",
    },
  ];

  return (
    <div className="card" style={{
      display: "grid",
      gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1.6fr",
      overflow: "hidden",
    }}>
      {metrics.map((m) => (
        <Fragment key={m.label}>
          <Link href={m.href} style={{ textDecoration: "none", padding: "16px 20px", display: "block", transition: "background 0.12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <m.Icon size={12} color="var(--muted-foreground)" />
              <span className="stat-label" style={{ marginBottom: 0 }}>{m.label}</span>
            </div>
            <p className="stat-value" style={{ color: m.valueColor, marginBottom: 3 }}>
              {m.value}
            </p>
            <p style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", margin: 0 }}>{m.sub}</p>
          </Link>

          {/* Divider */}
          <div style={{ background: "var(--border)" }} />
        </Fragment>
      ))}

      {/* Annual target */}
      <Link href="/reports" style={{ textDecoration: "none", padding: "16px 20px", display: "block", transition: "background 0.12s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Target size={12} color="var(--muted-foreground)" />
          <span className="stat-label" style={{ marginBottom: 0 }}>เป้ารายปี 2026</span>
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", fontWeight: 700, color: "#003366" }}>
            {pct}%
          </span>
        </div>
        <p className="stat-value" style={{ color: "#003366", marginBottom: 8 }}>
          ฿{fmt(ytdActual)}
          <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 5 }}>
            / ฿{fmt(annualTarget)}
          </span>
        </p>
        <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
          <div className="top5-bar" style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            borderRadius: 999,
            background: "#003366",
          }} />
        </div>
      </Link>
    </div>
  );
}
