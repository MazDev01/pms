"use client";

// ─── KPI ฐานข้อมูลลูกค้าทั้งเครือ (4 ตัว — ทุกหน้าใช้ KPI 4 ใบเท่ากัน) ─────────────
// ทุกตัวคำนวณจากข้อมูลจริง: ใช้งานอยู่ / ซื้อซ้ำ → นับจากใบที่ปิดการขายได้จริง
// "ใช้งานอยู่" = ลูกค้าที่ซื้อแล้ว (ตามสเปก) — ไม่ใช่ฟิลด์ status เดิม
// ตัดออกตอนเหลือ 4 ใบ: ยอดซื้อเฉลี่ย · ประเภทอาคาร · ส่งมอบเดือนนี้ · อยู่ในประกัน
import { Users, UserCheck, Coins, Repeat } from "lucide-react";
import { fmtBaht } from "@pms/shared/lib/format";
import type { CustomerDbRow } from "@pms/shared/lib/customerDb";

type Tile = { label: string; value: string; sub: string; Icon: typeof Users; color: string; bg: string };

export function CustomerKPICards({ rows }: { rows: CustomerDbRow[] }) {
  const total = rows.length;
  const active = rows.filter(r => r.buildings.length > 0).length;
  const revenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const repeat = rows.filter(r => r.isRepeat).length;

  const tiles: Tile[] = [
    { label: "ลูกค้าทั้งหมด",   value: `${total}`,       sub: "ราย",        Icon: Users,     color: "#003366", bg: "#E8F0FE" },
    { label: "ใช้งานอยู่",      value: `${active}`,      sub: "ซื้อแล้ว",    Icon: UserCheck, color: "#059669", bg: "#E6F6EF" },
    { label: "มูลค่ารวม",       value: fmtBaht(revenue), sub: "ยอดซื้อสะสม", Icon: Coins,     color: "#0891B2", bg: "#E6F4F9" },
    { label: "ลูกค้าซื้อซ้ำ",    value: `${repeat}`,      sub: "ราย",        Icon: Repeat,    color: "#DB2777", bg: "#FDEBF3" },
  ];

  return (
    <div className="hq-kpi4" style={{ marginBottom: "1.25rem" }}>
      {tiles.map(t => (
        <div key={t.label} className="card" style={{ marginBottom: 0, padding: "14px 14px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.68rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.2, marginTop: 5, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>{t.value}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.sub}</div>
          </div>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <t.Icon size={17} color={t.color} strokeWidth={2.1} />
          </span>
        </div>
      ))}
    </div>
  );
}
