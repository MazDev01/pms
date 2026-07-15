"use client";

// ─── #1+#2 ใบเสนอราคา รายตัวแทน (แท่งแนวนอน) ─────────────────────────────────
// รวมจำนวนใบ + มูลค่าไว้ในกราฟเดียว: ความยาวแท่ง = มูลค่า · ข้อความรอง = จำนวนใบ
// (บอสสั่งว่าข้อมูลซ้ำให้รวมเป็นกราฟเดียว — ไม่แยกกราฟจำนวน/มูลค่าเป็นสองใบ)
import { DealerChart } from "@/components/hq/DealerChart";
import { fmtBaht } from "@/lib/format";
import { aggregate, groupBy, type QuoteRow } from "@/lib/hqQuotations";

export function DealerRankingChart({ rows }: { rows: QuoteRow[] }) {
  const bars = [...groupBy(rows, r => r.dealerCode).entries()].map(([code, list]) => {
    const agg = aggregate(list);
    return { code, name: list[0].dealerName, value: agg.value, note: `${agg.count} ใบ` };
  });

  return (
    <DealerChart
      title="ใบเสนอราคา รายตัวแทน"
      hint="ความยาวแท่ง = มูลค่า · คลิกเพื่อเจาะรายตัวแทน"
      rows={bars}
      fmt={fmtBaht}
    />
  );
}
