"use client";

// ─── #8 อายุใบเสนอราคาที่ค้างอยู่ (Aging) ─────────────────────────────────────
// นับเฉพาะใบที่ "ส่งแล้วแต่ลูกค้ายังไม่ตอบ" — ใบที่ปิดไปแล้วไม่มีอายุค้าง
// จำนวนวัน = วันที่สร้าง → "วันนี้" ของระบบ (30 มิ.ย. 2569)
import { AGING_BUCKETS, agingBucketOf, type QuoteRow } from "@/lib/hqQuotations";
import { fmtBaht } from "@/lib/format";

export function QuotationAgingChart({ rows }: { rows: QuoteRow[] }) {
  const pending = rows.filter(r => r.pending && r.agingDays != null);
  const buckets = AGING_BUCKETS.map(b => {
    const list = pending.filter(r => agingBucketOf(r.agingDays!) === b.key);
    return { ...b, count: list.length, value: list.reduce((s, r) => s + r.valueNum, 0) };
  });
  const max = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">อายุใบเสนอราคาที่ค้างอยู่</div>
          <div className="card-desc">เฉพาะใบที่ส่งแล้วแต่ลูกค้ายังไม่ตอบรับ/ปฏิเสธ ({pending.length} ใบ)</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
        {!pending.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : buckets.map(b => (
          <div key={b.key}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#374151", fontWeight: 600 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color, flexShrink: 0 }} />{b.label}
              </span>
              <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontWeight: 800, color: "#1F2937" }}>{b.count} ใบ</span>
                <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{fmtBaht(b.value)}</span>
              </span>
            </div>
            <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
              <div className="bar-grow" style={{ height: "100%", width: `${Math.round(b.count / max * 100)}%`, background: b.color, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
