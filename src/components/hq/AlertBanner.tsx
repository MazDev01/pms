"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { dealerLeaderboard, hqDealSummary } from "@/lib/mock";

export function AlertBanner() {
  const atRisk = dealerLeaderboard
    .filter(d => d.status === "active")
    .filter(d => d.revenueActual / d.revenueTarget < 0.7);

  const lateLeads = hqDealSummary.leadsOverdue;

  type Alert = { text: string; detail?: string; href: string };

  const alerts: Alert[] = [
    atRisk.length > 0 && {
      text: `${atRisk.length} สาขาต่ำกว่าเป้า`,
      detail: atRisk.map(d => d.name.replace("Benjamin ", "")).join(", "),
      href: "/hq/dealers",
    },
    lateLeads > 0 && {
      text: `${lateLeads} ผู้สนใจรอติดตาม > 48 ชม.`,
      href: "/hq/lead-pool",
    },
  ].filter(Boolean) as Alert[];

  if (alerts.length === 0) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px" }}>
        <CheckCircle2 size={13} color="#059669" />
        <span style={{ fontSize: "0.72rem", color: "var(--muted-foreground)" }}>ทุกอย่างปกติ</span>
      </div>
    );
  }

  return (
    <div className="card" style={{
      display: "flex", alignItems: "center", gap: 0,
      overflow: "hidden",
    }}>
      {/* Icon label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
        <span className="badge" style={{ background: "#fff3cd", color: "#d97706" }}>
          <AlertTriangle size={13} />
          แจ้งเตือน
        </span>
      </div>

      {/* Alerts — plain text links separated by dots */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", padding: "0 12px", gap: 0 }}>
        {alerts.map((a, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span style={{ color: "var(--border)", margin: "0 8px", fontSize: "0.7rem" }}>·</span>}
            <Link href={a.href} style={{ textDecoration: "none" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: "0.72rem", color: "var(--foreground)", fontWeight: 500,
                padding: "6px 4px",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#003366"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
              >
                {a.text}
                {a.detail && <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}> ({a.detail})</span>}
                <ChevronRight size={10} color="var(--muted-foreground)" />
              </span>
            </Link>
          </span>
        ))}
      </div>
    </div>
  );
}
