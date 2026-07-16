"use client";

// ─── #8 อายุใบเสนอราคาที่ค้างอยู่ (Aging) ─────────────────────────────────────
// นับเฉพาะใบที่ "ส่งแล้วแต่ลูกค้ายังไม่ตอบ" — ใบที่ปิดไปแล้วไม่มีอายุค้าง
// จำนวนวัน = วันที่สร้าง → "วันนี้" ของระบบ (30 มิ.ย. 2569)
import { AGING_BUCKETS, agingBucketOf, type QuoteRow } from "@/lib/hqQuotations";
import { fmtBaht } from "@/lib/format";
import { Donut } from "@/components/ui/Charts";

export function QuotationAgingChart({ rows }: { rows: QuoteRow[] }) {
  const pending = rows.filter(r => r.pending && r.agingDays != null);
  const buckets = AGING_BUCKETS.map(b => {
    const list = pending.filter(r => agingBucketOf(r.agingDays!) === b.key);
    return { ...b, count: list.length, value: list.reduce((s, r) => s + r.valueNum, 0) };
  });
  // agingBucketOf จับใบหนึ่งลงช่วงเดียวเสมอ → 4 ช่วงไม่ทับกันและรวมกัน = ใบที่ค้างทั้งหมดพอดี ทำโดนัทได้
  const shown = buckets.filter(b => b.count > 0);

  return (
    <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <div className="card-title">อายุใบเสนอราคาที่ค้างอยู่</div>
          <div className="card-desc">เฉพาะใบที่ส่งแล้วแต่ลูกค้ายังไม่ตอบรับ/ปฏิเสธ ({pending.length} ใบ)</div>
        </div>
      </div>
      {/* ข้อมูลแค่ 4 ช่วง → โดนัทอ่านง่ายกว่าแท่ง (สีเดิมของแต่ละช่วง: เขียว→เหลือง→ส้ม→แดง ตามความเร่งด่วน) */}
      <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {!pending.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : (<>
          <Donut
            segments={shown.map(b => ({ label: b.label, value: b.count, color: b.color }))}
            centerLabel="ใบที่ค้าง"
            centerValue={`${pending.length}`}
            size={168}
          />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
            {shown.map(b => (
              <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>{b.label}</span>
                <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
                {/* มูลค่ารวมของช่วงนั้น — ข้อมูลจริง ไม่ตัดทิ้งตอนเปลี่ยนเป็นโดนัท */}
                <span style={{ color: "var(--muted-foreground)", fontWeight: 600, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(b.value)}</span>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </div>
  );
}
