"use client";

import Link from "next/link";
import {
  Target, TrendingUp, TrendingDown, Award, Building2, DollarSign, Phone, Users,
  ScrollText, GitMerge, Handshake, Store, CheckCircle2, XCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  target: Target, trending: TrendingUp, trendingdown: TrendingDown, award: Award, building: Building2,
  dollar: DollarSign, phone: Phone, users: Users, doc: ScrollText, deal: GitMerge,
  handshake: Handshake, store: Store, check: CheckCircle2, x: XCircle,
};

export type KpiProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  icon: string;
  sub?: string;
  current?: number;
  target?: number;
  targetLabel?: string;
  href?: string;
};

export function KpiCard({ label, value, unit, delta, icon, sub, current, target, targetLabel, href }: KpiProps) {
  const Icon = ICONS[icon] ?? TrendingUp;
  const pct = current !== undefined && target ? Math.min(100, Math.round((current / target) * 100)) : null;
  const barColor = pct === null ? "var(--pr)" : pct >= 80 ? "var(--success)" : pct >= 40 ? "var(--pr)" : pct >= 25 ? "var(--warning)" : "var(--danger)";

  const inner = (
    <>
      <div className="kc-hd">
        <div style={{ minWidth: 0 }}>
          <div className="kc-lbl">{label}</div>
          <div className="kc-val" style={{ marginTop: 8 }}>{value}{unit && <span className="cents"> {unit}</span>}</div>
        </div>
        <div className="kc-ico"><Icon size={19} /></div>
      </div>
      <div className="kc-foot">
        {delta !== undefined && (
          <span className={delta >= 0 ? "bdg-up" : "bdg-dn"}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%</span>
        )}
        {sub && <span className="kc-ct">{sub}</span>}
      </div>
      {pct !== null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, marginBottom: 4 }}>
            <span style={{ fontSize: ".62rem", color: "var(--sub)" }}>เป้า {targetLabel}</span>
            <span style={{ fontSize: ".64rem", fontWeight: 700, color: barColor }}>{pct}%</span>
          </div>
          <div className="mini-bar"><div className="mini-fill bar-grow" style={{ width: `${pct}%`, background: barColor }} /></div>
        </>
      )}
    </>
  );

  if (href) return <Link href={href} className="kc clickable" style={{ display: "block" }}>{inner}</Link>;
  return <div className="kc">{inner}</div>;
}
