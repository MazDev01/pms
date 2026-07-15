"use client";

// ─── #4 สถานะใบเสนอราคา แยกตามตัวแทน (แท่งซ้อน) ──────────────────────────────
// 6 สถานะที่ระบบมีจริง (ไม่มี "เจรจาต่อรอง" — สถานะนั้นอยู่ที่ดีล/ลีด ไม่ใช่ใบเสนอราคา)
import { StackedBarChart } from "@/components/ui/Charts";
import { quotationStatusLabel, quotationStatusColor } from "@/lib/mock";
import { STATUS_ORDER, groupBy, type QuoteRow } from "@/lib/hqQuotations";

// สีแท่ง = สีตัวอักษรของ badge สถานะ (พื้น badge อ่อนเกินไปเมื่อเป็นแท่ง)
const barColor = (s: (typeof STATUS_ORDER)[number]) =>
  s === "lost" ? "#dc2626" : s === "expired" ? "#d97706" : quotationStatusColor[s].text;

export function QuotationStatusChart({ rows }: { rows: QuoteRow[] }) {
  const byDealer = [...groupBy(rows, r => r.dealerCode).entries()]
    .map(([code, list]) => ({ code, list }))
    .sort((a, b) => b.list.length - a.list.length);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title">สถานะใบเสนอราคา แยกตามตัวแทน</div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ใบ</span>
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        {!byDealer.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : (
          <StackedBarChart
            months={byDealer.map(d => d.code)}
            height={320}
            fmt={v => `${Math.round(v)}`}
            series={STATUS_ORDER.map(s => ({
              name: quotationStatusLabel[s],
              color: barColor(s),
              data: byDealer.map(d => d.list.filter(q => q.status === s).length),
            }))}
          />
        )}
      </div>
    </div>
  );
}
