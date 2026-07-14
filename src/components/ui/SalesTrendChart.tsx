"use client";

import { useMemo, useState } from "react";
import { LineTrendChart } from "@/components/ui/Charts";
import { STEEL } from "@/lib/theme";

// ── กราฟแนวโน้มยอดขายที่ "กำหนดช่วงเวลาได้" ในตัว (ปุ่ม inline + รีบิลด์ตามวันจริง) ──
// ใช้ซ้ำได้ทุกหน้าที่มีกราฟแนวโน้ม (dashboard / reports / hq dashboard)
// monthly: ข้อมูลรายเดือนหน่วย "ล้านบาท" เรียงตามปฏิทิน (index 0 = ม.ค.)

const monthsTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysInclusive = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dmLabel = (d: Date) => `${d.getDate()} ${monthsTH[d.getMonth() + 1]}`;
const fmtDate = (iso: string) => { const [, mm, dd] = iso.split("-"); return `${parseInt(dd)} ${monthsTH[parseInt(mm)]}`; };

const RANGE_PILLS: { key: string; label: string }[] = [
  { key: "3m", label: "3 เดือน" },
  { key: "6m", label: "6 เดือน" },
  { key: "12m", label: "12 เดือน" },
];

export type MonthlyPoint = { month: string; value: number };

export function SalesTrendChart({
  title,
  desc,
  monthly,
  today = "2026-06-30",
  prevRatio = 0.86,
  initialRange = "6m",
  height,
}: {
  title: string;
  desc?: string;
  monthly: MonthlyPoint[];
  today?: string;
  prevRatio?: number;
  initialRange?: string;
  height?: number;
}) {
  const [range, setRange] = useState(initialRange);

  // ยอดขายต่อวัน (ล้านบาท) — เฉลี่ยจากยอดเดือน + คลื่นในเดือนให้เส้นดูเป็นธรรมชาติ
  const dayValue = useMemo(() => (d: Date): number => {
    const m = d.getMonth();
    const mv = monthly[m]?.value ?? monthly[m % monthly.length]?.value ?? 0;
    const dim = new Date(d.getFullYear(), m + 1, 0).getDate();
    const base = mv / dim;
    const wave = 1 + 0.4 * Math.sin(d.getDate() * 0.7 + m);
    return Math.max(base * wave, base * 0.2);
  }, [monthly]);

  const buildDaily = useMemo(() => (start: Date, end: Date, maxPoints: number) => {
    const total = Math.max(1, daysInclusive(start, end));
    const bucket = Math.max(1, Math.ceil(total / maxPoints));
    const pts: { month: string; value: number; prevValue: number }[] = [];
    for (let i = 0; i < total; i += bucket) {
      let sum = 0;
      for (let j = 0; j < bucket && i + j < total; j++) sum += dayValue(addDays(start, i + j));
      const value = Math.round(sum * 10) / 10;
      pts.push({ month: dmLabel(addDays(start, i)), value, prevValue: Math.round(value * prevRatio * 10) / 10 });
    }
    return pts;
  }, [dayValue, prevRatio]);

  const asPoints = (arr: MonthlyPoint[]) => arr.map(d => ({
    month: d.month,
    value: Math.round(d.value * 10) / 10,
    prevValue: Math.round(d.value * prevRatio * 10) / 10,
  }));

  const data = useMemo(() => {
    const n = range === "3m" ? 3 : range === "12m" ? 12 : 6; // slice N เดือนล่าสุด
    return asPoints(monthly.slice(-n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, monthly]);

  const rangeDesc = range === "3m" ? "3 เดือนที่ผ่านมา (รายเดือน)"
    : range === "12m" ? "12 เดือนที่ผ่านมา (รายเดือน)"
    : "6 เดือนที่ผ่านมา (รายเดือน)";

  // ตัวเลขรวม + การเติบโต (จุดแรก → จุดสุดท้ายของช่วงที่เลือก) — สไตล์การ์ดสถิติ
  const total = data.reduce((s, d) => s + d.value, 0);
  const growth = data.length >= 2 && data[0].value ? Math.round(((data[data.length - 1].value - data[0].value) / data[0].value) * 100) : 0;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text, #2D2D2D)" }}>{title}</div>
          {/* ตัวเลขเด่น + trend (เหมือนการ์ดสถิติ) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 2px" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#003366", lineHeight: 1 }}>฿{(total).toFixed(1)}M</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: "0.72rem", fontWeight: 800,
              color: growth >= 0 ? "#059669" : "#dc2626" }}>
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}%
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--sub, #8a94a3)" }}>{desc ? `${desc} · ${rangeDesc}` : rangeDesc}</div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
          {RANGE_PILLS.map(p => (
            <button key={p.key} onClick={() => setRange(p.key)}
              className={range === p.key ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              style={{ padding: "4px 9px", fontSize: "0.72rem" }}>{p.label}</button>
          ))}
        </div>
      </div>

      <LineTrendChart key={range} data={data} height={height} />
    </div>
  );
}
