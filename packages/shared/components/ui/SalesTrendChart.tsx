"use client";

import { useMemo, useState } from "react";
import { LineTrendChart } from "@pms/shared/components/ui/Charts";

// ── กราฟแนวโน้มยอดขายที่ "กำหนดช่วงเวลาได้" ในตัว (ปุ่ม inline) ──
// ใช้ซ้ำได้ทุกหน้าที่มีกราฟแนวโน้ม (dashboard / reports / hq dashboard)
// monthly: ข้อมูลรายเดือนหน่วย "ล้านบาท" เรียงตามปฏิทิน (index 0 = ม.ค.)
//
// เคยมีโหมด "รายวัน" (ปั้นยอดรายวันจากยอดรายเดือนด้วยคลื่นไซน์) ค้างอยู่ในไฟล์นี้ทั้งชุด
// แต่ไม่เคยถูกเรียกใช้เลย — และเป็นตัวเลขที่ปั้นขึ้นเอง ไม่ใช่ยอดขายจริงรายวัน จึงเอาออกทั้งหมด

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
  prevRatio = 0.86,
  initialRange = "6m",
  height,
}: {
  title: string;
  desc?: string;
  monthly: MonthlyPoint[];
  prevRatio?: number;
  initialRange?: string;
  height?: number;
}) {
  const [range, setRange] = useState(initialRange);

  const data = useMemo(() => {
    const n = range === "3m" ? 3 : range === "12m" ? 12 : 6; // slice N เดือนล่าสุด
    // แปลงจุดอยู่ในนี้เลย — เดิมแยกเป็นฟังก์ชันข้างนอกซึ่งปิดคลุม prevRatio ไว้เงียบ ๆ
    // ทำให้ต้องจำเองว่าต้องใส่ prevRatio ในรายการที่เฝ้าดูด้วย (เคยลืมมาแล้วจน prevValue ค้างค่าเก่า)
    return monthly.slice(-n).map(d => ({
      month: d.month,
      value: Math.round(d.value * 10) / 10,
      prevValue: Math.round(d.value * prevRatio * 10) / 10,
    }));
  }, [range, monthly, prevRatio]);

  // ⚠️ ต้องบอกตามจำนวนเดือนที่มีข้อมูลจริง (แก้ 10 ส.ค. 69)
  //   เดิมกด "12 เดือน" แล้วคำบรรยายเขียน "12 เดือนที่ผ่านมา" เสมอ
  //   แต่ถ้าผู้เรียกส่งข้อมูลมาแค่ 8 เดือน slice(-12) ก็ได้ 8 เดือน → คำบรรยายไม่ตรงกับกราฟ
  //   ผู้บริหารอ่านแล้วเข้าใจว่าย้อนหลังครบปี ทั้งที่เห็นแค่ 8 เดือน
  const askedMonths = range === "3m" ? 3 : range === "12m" ? 12 : 6;
  const rangeDesc = data.length < askedMonths
    ? `${data.length} เดือนที่มีข้อมูล (ขอ ${askedMonths} เดือน · รายเดือน)`
    : `${askedMonths} เดือนที่ผ่านมา (รายเดือน)`;

  // ตัวเลขรวม + การเติบโต (จุดแรก → จุดสุดท้ายของช่วงที่เลือก) — สไตล์การ์ดสถิติ
  const total = data.reduce((s, d) => s + d.value, 0);
  // ⚠️ เดือนตั้งต้นเป็น 0 = คิดเป็นเปอร์เซ็นต์ไม่ได้ ต้องขึ้น "—" (แก้ 10 ส.ค. 69)
  //   เดิมคืน 0 แล้วไปแสดงเป็น "▲ 0%" ลูกศรเขียวขึ้น ทั้งที่ความจริงคือ "เทียบไม่ได้"
  //   เจอจริงตอนยอดขึ้นจาก ฿0 เป็น ฿10.2M แต่การ์ดยังขึ้น "▲ 0%" เหมือนไม่มีอะไรเปลี่ยน
  const growth = data.length >= 2 && data[0].value
    ? Math.round(((data[data.length - 1].value - data[0].value) / data[0].value) * 100)
    : null;


  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text, #2D2D2D)" }}>{title}</div>
          {/* ตัวเลขเด่น + trend (เหมือนการ์ดสถิติ) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 2px" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#003366", lineHeight: 1 }}>฿{(total).toFixed(1)}M</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: "0.72rem", fontWeight: 800,
              color: growth === null ? "#8a94a3" : growth >= 0 ? "#059669" : "#dc2626" }}
              title={growth === null ? "เดือนตั้งต้นเป็น 0 — คิดเป็นเปอร์เซ็นต์ไม่ได้" : undefined}>
              {growth === null ? "—" : <>{growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}%</>}
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--sub, #8a94a3)" }}>{desc ? `${desc} · ${rangeDesc}` : rangeDesc}</div>
        </div>
        {/* ปุ่มช่วงเวลาของกราฟใบนี้ทำใหญ่กว่ากราฟใบอื่น (บอสสั่ง 24 ส.ค. 69: สูง ~36px มุมมน 10–12px)
            hover/focus ทำด้วย inline style ไม่ได้ จึงประกาศคลาสไว้ในไฟล์นี้ที่เดียว */}
        <style>{`
          .trend-pill{font-family:inherit;font-size:.74rem;font-weight:700;white-space:nowrap;height:36px;padding:0 14px;
            border-radius:11px;cursor:pointer;border:1px solid #E5E7EB;background:#fff;color:#6B7280;
            transition:background .15s ease,color .15s ease,border-color .15s ease}
          .trend-pill:hover{background:#f5f8fc;color:#003366;border-color:#cfd9e6}
          .trend-pill:focus-visible{outline:2px solid #003366;outline-offset:2px}
          .trend-pill[aria-pressed="true"]{background:#003366;border-color:#003366;color:#fff}
          .trend-pill[aria-pressed="true"]:hover{background:#00284f}
        `}</style>
        <div role="group" aria-label="ช่วงเวลากราฟแนวโน้มยอดขาย" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
          {RANGE_PILLS.map(p => (
            <button key={p.key} type="button" className="trend-pill" onClick={() => setRange(p.key)} aria-pressed={range === p.key}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <LineTrendChart key={range} data={data} height={height} />

    </div>
  );
}
