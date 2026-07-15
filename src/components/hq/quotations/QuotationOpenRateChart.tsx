"use client";

// ─── #3 อัตราการเปิดอ่าน รายตัวแทน ────────────────────────────────────────────
// แท่งซ้อนแนวนอน: เปิดอ่านแล้ว vs ยังไม่เปิด (นับเฉพาะใบที่ "ส่งแล้ว" — ใบร่างยังไม่ถึงลูกค้า)
// ข้อจำกัดจริง: ระบบเก็บสถานะเดียวต่อใบ → ใบที่ตอบรับ/ปฏิเสธไปแล้วสถานะทับ "เปิดอ่านแล้ว" ไป
// จึงไม่ถูกนับ ต้องเขียนกำกับให้ผู้อ่านรู้ ห้ามเดาแทนลูกค้าว่าเคยเปิดหรือไม่
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { aggregate, groupBy, type QuoteRow } from "@/lib/hqQuotations";

const OPENED = "#7c3aed";
const NOT_OPENED = "#dce5f0";

export function QuotationOpenRateChart({ rows }: { rows: QuoteRow[] }) {
  const router = useRouter();
  const bars = [...groupBy(rows, r => r.dealerCode).entries()]
    .map(([code, list]) => {
      const agg = aggregate(list);
      return { code, name: list[0].dealerName, ...agg, notOpened: agg.sent - agg.opened };
    })
    .filter(b => b.sent > 0)
    .sort((a, b) => b.openRate - a.openRate || b.sent - a.sent);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">อัตราการเปิดอ่าน รายตัวแทน</div>
          <div className="card-desc">นับจากสถานะปัจจุบันของใบที่ส่งแล้ว — ใบที่ลูกค้าตอบรับ/ปฏิเสธไปแล้วสถานะทับไป จึงไม่นับเป็นเปิดอ่าน</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
        {!bars.length ? (
          <EmptyState icon={<BarChart3 size={26} />} title="ไม่มีใบเสนอราคาที่ส่งแล้ว" description="ลองปรับตัวกรอง" compact />
        ) : (
          <>
            {bars.map(b => (
              <div key={b.code} className="clickable" onClick={() => router.push(`/hq/dealers/${b.code}`)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#003366", marginRight: 6 }}>{b.code}</span>
                    <span style={{ color: "#374151", fontWeight: 600 }}>{b.name}</span>
                  </span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{b.opened}/{b.sent} ใบ</span>
                    <span style={{ fontWeight: 800, color: OPENED }}>{b.openRate}%</span>
                  </span>
                </div>
                <div style={{ display: "flex", height: 7, borderRadius: 999, overflow: "hidden", background: NOT_OPENED }}>
                  <div className="bar-grow" style={{ width: `${b.openRate}%`, background: OPENED }} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 14, marginTop: 2, paddingTop: 10, borderTop: "1px solid #f0f4f8", fontSize: "0.68rem", color: "var(--muted-foreground)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 6, borderRadius: 2, background: OPENED }} />เปิดอ่านแล้ว</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 6, borderRadius: 2, background: NOT_OPENED }} />ยังไม่เปิด</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
