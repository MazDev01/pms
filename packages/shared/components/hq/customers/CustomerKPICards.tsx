"use client";

// ─── KPI ฐานข้อมูลลูกค้าทั้งเครือ (4 ตัว — ทุกหน้าใช้ KPI 4 ใบเท่ากัน) ─────────────
// ทุกตัวคำนวณจากข้อมูลจริง: ยังซื้ออยู่ / ซื้อซ้ำ → นับจากใบที่ปิดการขายได้จริง
// ⚠️ "ยังซื้ออยู่" = มีการซื้อภายใน 12 เดือนล่าสุด (บอสทัก 24 ส.ค. 69)
//    ของเดิมคือ "เคยซื้อแล้ว" ซึ่งเท่ากับ "ลูกค้าทั้งหมด" ตลอดกาล (ระบบสร้างลูกค้าได้ทางเดียว
//    คือปิดการขายสำเร็จ) การ์ดจึงโชว์เลขซ้ำกับใบข้าง ๆ ไม่ได้บอกอะไรเพิ่มเลย
// ตัดออกตอนเหลือ 4 ใบ: ยอดซื้อเฉลี่ย · ประเภทอาคาร · ส่งมอบเดือนนี้ · อยู่ในประกัน
import { Users, UserCheck, Coins, Repeat } from "lucide-react";
import { fmtBaht } from "@pms/shared/lib/format";
import type { HQCustomersKPI } from "@pms/shared/lib/data/ports";

type Tile = { label: string; value: string; sub: string; Icon: typeof Users; color: string; bg: string };

// kpi คำนวณที่ DB จากทั้งชุดที่กรองแล้ว (ไม่ใช่แค่หน้าตารางที่กำลังโชว์) — M9 Phase 6, migration 0080
export function CustomerKPICards({ kpi }: { kpi: HQCustomersKPI }) {
  const { total, active, revenue, repeat } = kpi;

  const tiles: Tile[] = [
    { label: "ลูกค้าทั้งหมด",   value: `${total}`,       sub: "ราย",        Icon: Users,     color: "#003366", bg: "#E8F0FE" },
    { label: "ยังซื้ออยู่",      value: `${active}`,      sub: "ซื้อใน 12 เดือน", Icon: UserCheck, color: "#059669", bg: "#E6F6EF" },
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
