"use client";

import { useMemo, useState } from "react";
import { AreaGradientChart } from "@/components/ui/Charts";
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
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
  { key: "month", label: "เดือนนี้" },
  { key: "quarter", label: "ไตรมาส" },
  { key: "year", label: "ปีนี้" },
];

export type MonthlyPoint = { month: string; value: number };

export function SalesTrendChart({
  title,
  desc,
  monthly,
  today = "2026-06-30",
  prevRatio = 0.86,
  initialRange = "year",
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
  const [customStart, setCustomStart] = useState("2026-06-01");
  const [customEnd, setCustomEnd] = useState("2026-06-30");

  const TODAY = useMemo(() => parseISO(today), [today]);

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
    const tm = TODAY.getMonth();
    switch (range) {
      case "year": return asPoints(monthly);
      case "quarter": { const q = Math.floor(tm / 3) * 3; return asPoints(monthly.slice(q, q + 3)); }
      case "7d": return buildDaily(addDays(TODAY, -6), TODAY, 7);
      case "30d": return buildDaily(addDays(TODAY, -29), TODAY, 10);
      case "month": return buildDaily(new Date(TODAY.getFullYear(), tm, 1), TODAY, 6);
      case "custom": {
        let s = parseISO(customStart), e = parseISO(customEnd);
        if (e < s) [s, e] = [e, s];
        return buildDaily(s, e, 12);
      }
      default: return asPoints(monthly);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd, monthly, TODAY, buildDaily]);

  const rangeDesc = useMemo(() => {
    const tm = TODAY.getMonth();
    if (range === "custom") return `${fmtDate(customStart)} – ${fmtDate(customEnd)}`;
    if (range === "year") return "ทั้งปี (รายเดือน)";
    if (range === "quarter") return "ไตรมาสปัจจุบัน (รายเดือน)";
    if (range === "month") return "เดือนนี้ (รายวัน)";
    if (range === "7d") return `${dmLabel(addDays(TODAY, -6))} – ${dmLabel(TODAY)} (รายวัน)`;
    return `${dmLabel(addDays(TODAY, -29))} – ${dmLabel(TODAY)} (รายวัน)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd, TODAY]);

  const inputStyle = { padding: "6px 10px", border: "1px solid var(--border,#dde3ea)", borderRadius: 8, fontFamily: "inherit", fontSize: "0.8rem", color: STEEL } as const;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--text, #2D2D2D)" }}>{title}</div>
          <div style={{ fontSize: "0.76rem", color: "var(--sub, #8a94a3)" }}>{desc ? `${desc} · ${rangeDesc}` : rangeDesc}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RANGE_PILLS.map(p => (
            <button key={p.key} onClick={() => setRange(p.key)}
              className={range === p.key ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              style={{ padding: "5px 12px" }}>{p.label}</button>
          ))}
          <button onClick={() => setRange("custom")}
            className={range === "custom" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            style={{ padding: "5px 12px" }}>กำหนดเอง</button>
        </div>
      </div>

      {range === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, fontSize: "0.8rem", color: STEEL }}>
          <span style={{ fontWeight: 600 }}>ช่วงวันที่:</span>
          <input type="date" value={customStart} min="2026-01-01" max="2026-12-31" onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
          <span style={{ color: "var(--sub,#8a94a3)" }}>ถึง</span>
          <input type="date" value={customEnd} min="2026-01-01" max="2026-12-31" onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
        </div>
      )}

      <AreaGradientChart key={`${range}-${customStart}-${customEnd}`} data={data} height={height} />
    </div>
  );
}
