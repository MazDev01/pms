"use client";

// ─── KPI ใบเสนอราคาทั้งเครือ (7 ตัว) ──────────────────────────────────────────
// ทุกตัวคำนวณจากข้อมูลจริง — ไม่มี "จำนวนวันเฉลี่ยที่ใช้ปิดดีล" เพราะระบบไม่เก็บวันที่ลูกค้าตอบรับ/ปฏิเสธ
// ไม่มี "ลูกค้าเปิดอ่าน" เพราะระบบไม่มีการติดตามการเปิดอ่าน (ถูกลบทั้งฟีเจอร์)
import { FileText, Coins, Percent, Calculator, CheckCircle2, XCircle, CalendarX } from "lucide-react";
import { fmtBaht } from "@/lib/format";
import { conversionRate, avgQuoteValue, type QuoteAgg } from "@/lib/hqQuotations";

type Tile = { label: string; value: string; sub: string; Icon: typeof FileText; color: string; bg: string };

export function QuotationKPICards({ agg, expired }: { agg: QuoteAgg; expired: number }) {
  const tiles: Tile[] = [
    { label: "ใบเสนอราคาทั้งหมด", value: `${agg.count}`, sub: "ใบ", Icon: FileText, color: "#003366", bg: "#E8F0FE" },
    { label: "มูลค่ารวม", value: fmtBaht(agg.value), sub: "ก่อน VAT", Icon: Coins, color: "#0891B2", bg: "#E6F4F9" },
    { label: "ตอบรับ", value: `${agg.accepted}`, sub: "ใบ", Icon: CheckCircle2, color: "#059669", bg: "#E6F6EF" },
    { label: "ปฏิเสธ", value: `${agg.rejected}`, sub: "ใบ", Icon: XCircle, color: "#DC2626", bg: "#FDECEC" },
    { label: "หมดอายุ", value: `${expired}`, sub: "ใบ", Icon: CalendarX, color: "#D97706", bg: "#FEF0E6" },
    { label: "อัตราปิดการขาย", value: `${conversionRate(agg)}%`, sub: `${agg.accepted}/${agg.sent} ใบที่ส่งแล้ว`, Icon: Percent, color: "#7C3AED", bg: "#F1EBFD" },
    { label: "มูลค่าเฉลี่ยต่อใบ", value: fmtBaht(avgQuoteValue(agg)), sub: "ก่อน VAT", Icon: Calculator, color: "#0F766E", bg: "#E6F4F2" },
  ];

  return (
    <div className="hq-kpi7" style={{ marginBottom: "1.25rem" }}>
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
