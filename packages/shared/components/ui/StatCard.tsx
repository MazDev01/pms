"use client";

import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useFilters } from "@pms/shared/context/FilterContext";
import { CountUp } from "@pms/shared/components/ui/CountUp";

const PRIMARY = "#003366";

/** Stat Card (สไตล์ shadcn statistics) — icon + label + ตัวเลขเด่น + trend pill
 *  การ์ดตามช่วงเวลาจากตัวกรองหลัก (FilterBar) อัตโนมัติ · ไม่มี dropdown ช่วงวันรายการ์ด
 *  metric(days) คืนค่า { value, trend } ที่คำนวณจากข้อมูลจริงตามจำนวนวัน */
export function StatCard({ icon, label, metric, onClick }: {
  icon: ReactNode;
  label: string;
  metric: (days: number) => { value: string; trend: number };
  onClick?: () => void;
}) {
  const { timeRange } = useFilters();
  // จำนวนวันของตัวกรองหลัก (คำนวณจากช่วงวันที่)
  const days = Math.max(1, Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / 86_400_000) + 1);
  const { value, trend } = metric(days);
  const up = trend >= 0;

  return (
    <div className="card" style={{ padding: 20, cursor: onClick ? "pointer" : "default", position: "relative" }}
      onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === "Enter") onClick(); } : undefined}>
      {/* header: icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, marginBottom: 14 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: "#dce5f0", color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </div>
      {/* value + trend pill — ขนาด/badge เดียวกับ KpiCard (.kc-val/.bdg-up/.bdg-dn) ทั้งระบบ */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.7rem", fontWeight: 800, color: "#2D2D2D", lineHeight: 1 }}><CountUp value={value} /></span>
        <span className={up ? "bdg-up" : "bdg-dn"}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : ""}{trend}%
        </span>
      </div>
    </div>
  );
}
