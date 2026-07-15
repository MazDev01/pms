"use client";

// ─── ส่วนวิเคราะห์ใบเสนอราคาทั้งเครือ ─────────────────────────────────────────
// #1+#2 ใบเสนอราคารายตัวแทน · #3 อัตราการเปิดอ่าน · #4 สถานะแยกตัวแทน
// #5 แนวโน้ม 12 เดือน · #6 เทียบรายภูมิภาค · #7 อันดับตัวแทน · #8 อายุใบที่ค้าง
// ใช้เฉพาะแท่ง/แท่งแนวนอน/แท่งซ้อน/เส้น — ไม่มีกรวย/วงกลม/เกจ
import { useRouter } from "next/navigation";
import { DealerRankingChart } from "./DealerRankingChart";
import { QuotationOpenRateChart } from "./QuotationOpenRateChart";
import { QuotationStatusChart } from "./QuotationStatusChart";
import { QuotationTrendChart } from "./QuotationTrendChart";
import { QuotationAgingChart } from "./QuotationAgingChart";
import { aggregate, groupBy, regionDisplay, type QuoteRow } from "@/lib/hqQuotations";
import { fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];

// ── #6 เทียบรายภูมิภาค — จำนวนใบ · มูลค่า · อัตราการเปิดอ่าน ──
function RegionalComparison({ rows }: { rows: QuoteRow[] }) {
  const regions = [...groupBy(rows, r => r.region).entries()]
    .map(([region, list]) => ({ region, ...aggregate(list) }))
    .sort((a, b) => b.value - a.value);
  const maxV = Math.max(...regions.map(r => r.value), 1);
  const maxC = Math.max(...regions.map(r => r.count), 1);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title">เทียบรายภูมิภาค</div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>มูลค่า · จำนวนใบ · อัตราเปิดอ่าน</span>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
        {!regions.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : regions.map((r, i) => (
          <div key={r.region}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
              <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{regionDisplay(r.region)}</span>
              <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ color: "#7c3aed", fontWeight: 700 }}>เปิดอ่าน {r.openRate}%</span>
                <span style={{ fontWeight: 800, color: "#1F2937" }}>{fmtBaht(r.value)}</span>
              </span>
            </div>
            <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden", marginBottom: 3 }}>
              <div className="bar-grow" style={{ height: "100%", width: `${Math.round(r.value / maxV * 100)}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(r.count / maxC * 100)}%`, background: "#C0C0C0", borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 44, textAlign: "right" }}>{r.count} ใบ</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── #7 อันดับตัวแทน — ตาราง: ใบเสนอราคา · มูลค่า · อัตราเปิดอ่าน · ตอบรับ ──
function TopDealerRanking({ rows }: { rows: QuoteRow[] }) {
  const router = useRouter();
  const ranked = [...groupBy(rows, r => r.dealerCode).entries()]
    .map(([code, list]) => ({ code, name: list[0].dealerName, region: list[0].region, ...aggregate(list) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title">อันดับตัวแทนจำหน่าย</div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>เรียงตามมูลค่าใบเสนอราคา</span>
      </div>
      <div className="table-wrap">
        <table>
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>อันดับ</th>
              <th>รหัส</th>
              <th>ตัวแทนจำหน่าย</th>
              <th>ภูมิภาค</th>
              <th className="num">ใบเสนอราคา</th>
              <th className="num">มูลค่า</th>
              <th className="num">ตอบรับ</th>
            </tr>
          </thead>
          <tbody>
            {!ranked.length ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "28px 14px", color: "var(--muted-foreground)" }}>ไม่พบข้อมูล</td></tr>
            ) : ranked.map((d, i) => (
              <tr key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 700, color: "var(--muted-foreground)" }}>{i + 1}</td>
                <td style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY }}>{d.code}</td>
                <td style={{ fontWeight: 600, color: "#1F2937" }}>{d.name}</td>
                <td style={{ color: "#374151" }}>{regionDisplay(d.region)}</td>
                <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{d.count}</td>
                <td className="num" style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.value)}</td>
                <td className="num" style={{ fontWeight: 700, color: "#059669", fontVariantNumeric: "tabular-nums" }}>{d.accepted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QuotationAnalytics({ rows, trendRows }: { rows: QuoteRow[]; trendRows: QuoteRow[] }) {
  return (
    <>
      <div className="hq-dealer-charts">
        <DealerRankingChart rows={rows} />
        <QuotationOpenRateChart rows={rows} />
      </div>

      <div className="hq-dealer-charts">
        <QuotationStatusChart rows={rows} />
        <QuotationTrendChart rows={trendRows} />
      </div>

      <div className="hq-dealer-charts">
        <RegionalComparison rows={rows} />
        <QuotationAgingChart rows={rows} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <TopDealerRanking rows={rows} />
      </div>
    </>
  );
}
