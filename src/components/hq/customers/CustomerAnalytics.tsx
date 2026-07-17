"use client";

// ─── กราฟวิเคราะห์ฐานข้อมูลลูกค้า ────────────────────────────────────────────────
// ทุกกราฟนับจาก "ใบเสนอราคาที่ปิดการขายได้" ของลูกค้าในผลกรอง
// ลูกค้าที่ไม่มีใบปิดการขาย จะไม่ปรากฏในกราฟที่เกี่ยวกับอาคาร (ไม่ใช่การซ่อน — ไม่มีข้อมูลจริง)
//
// เลือกชนิดกราฟตาม "รูปร่างข้อมูล" ไม่ใช่ตามความสวย:
//   โดนัท   = กลุ่มต้องไม่ทับกันและรวมกันได้ยอดจริง (ลูกค้า 1 ราย = ตัวแทน 1 เจ้า → ใช้ได้)
//   แท่งตั้ง = เทียบค่าข้ามหมวดที่ป้ายสั้น (รหัสตัวแทน) และมี 2 ชุดตัวเลขหน่วยเดียวกัน
//   แท่งนอน = อันดับ/ป้ายไทยยาว หรือกลุ่มที่ "ทับกันได้" (ลูกค้า 1 รายซื้อหลายประเภทอาคาร → นับซ้ำในหลายแถว
//             เอาไปทำโดนัทไม่ได้ ผลรวมจะเกินจำนวนลูกค้าจริง)
import { TopNRows } from "@/components/hq/TopNRows";
import { Donut, GroupedBarChart } from "@/components/ui/Charts";
import { fmtBaht } from "@/lib/format";
import { type CustomerDbRow } from "@/lib/customerDb";

const PRIMARY = "#003366";
// ชุดสีโดนัท — ไล่จากกรมท่าเข้ม (ตัวแทนรายใหญ่) ไปอ่อน · ก้อน "ตัวแทนอื่น" ใช้เทาเสมอ
const DEALER_RAMP = ["#003366", "#0d5c9e", "#0891b2", "#0d9488", "#7c3aed", "#d97706"];
const REST_COLOR = "#94a3b8";

type HRow = { label: string; value: number; note?: string };

/** แท่งแนวนอน — เติมจากซ้าย (.bar-grow) ตามมาตรฐานแถบของระบบ · โชว์ 5 อันดับแรก ที่เหลือกดดู */
function HBar({ rows, fmt, color = PRIMARY, empty = "—", unit = "ราย" }: {
  rows: HRow[]; fmt: (v: number) => string; color?: string; empty?: string;
  /** หน่วยในปุ่ม "ดูทั้งหมด (อีก N ...)" — บอกให้ตรงกับสิ่งที่แถวนับ */
  unit?: string;
}) {
  // max คิดจากทุกแถวเสมอ (ไม่ใช่แค่แถวที่โชว์) — ไม่งั้นกด "ดูทั้งหมด" แล้วความยาวแท่งขยับ ทั้งที่ข้อมูลเท่าเดิม
  const max = Math.max(...rows.map(r => r.value), 0);
  if (!rows.length || max <= 0) return <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>{empty}</div>;
  return (
    <TopNRows topN={5} unit={unit} gap={10}>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: "0.72rem", color: "#2D2D2D", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: PRIMARY, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {fmt(r.value)}
              {r.note && <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}> · {r.note}</span>}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "#eef1f5", overflow: "hidden" }}>
            <div
              className="bar-grow"
              style={{
                width: `${(r.value / max) * 100}%`, height: "100%", borderRadius: 99,
                background: color, transformOrigin: "left", animationDelay: `${i * 50}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </TopNRows>
  );
}

// chart-m = ความสูงมาตรฐาน 340px ของการ์ดกราฟคู่ (ดู globals.css)
// การ์ดพวกนี้เคยสูง 479–519px และโตตามจำนวนแถว → หน้ายาว 5 จอ
// ตรึงความสูงแล้วให้แถวที่เกินเลื่อนเอาในการ์ด — ทุกใบสูงเท่ากันเป็นชุด อ่านเป็น "แถว" ได้ทันที
function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card chart-m" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>{hint}</span>
      </div>
      <div className="card-body" style={{ paddingTop: 12 }}>{children}</div>
    </div>
  );
}

/** นับจำนวนลูกค้าแยกตามคีย์ (ลูกค้า 1 รายที่ซื้อหลายแบบ นับในทุกแบบที่ซื้อ) */
function countCustomers(rows: CustomerDbRow[], keysOf: (r: CustomerDbRow) => string[]): HRow[] {
  const m = new Map<string, number>();
  rows.forEach(r => keysOf(r).forEach(k => m.set(k, (m.get(k) ?? 0) + 1)));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function CustomerAnalytics({ rows }: { rows: CustomerDbRow[] }) {
  // 1 · ลูกค้าตามประเภทอาคาร (แม่แบบหลัก)
  const byType = countCustomers(rows, r => r.buildingTypes);

  // 2 · ลูกค้าตามตัวแทน
  const byDealer = countCustomers(rows, r => [`${r.dealerCode} · ${r.dealerName}`]);

  // 2b · โดนัท "ลูกค้า ตามตัวแทน" — ลูกค้า 1 ราย = ตัวแทน 1 เจ้า → กลุ่มไม่ทับกัน รวมกันได้จำนวนลูกค้าจริง
  // ตัวแทนเกิน 6 เจ้ายุบเป็นก้อน "ตัวแทนอื่น" (ยังรวมได้ยอดเดิมเป๊ะ ไม่ตัดใครทิ้ง) — 10 ก้อนอ่านไม่ออก
  const dealerDonut = (() => {
    const top = byDealer.slice(0, 6).map((r, i) => ({ label: r.label, value: r.value, color: DEALER_RAMP[i] }));
    const rest = byDealer.slice(6);
    const restSum = rest.reduce((s, r) => s + r.value, 0);
    return restSum > 0
      ? [...top, { label: `ตัวแทนอื่น (${rest.length} เจ้า)`, value: restSum, color: REST_COLOR }]
      : top;
  })();
  const dealerTotal = dealerDonut.reduce((s, r) => s + r.value, 0);

  // 3 · ยอดซื้อตามตัวแทน — แท่งตั้ง ชุดเดียว (ยอดซื้อสะสม)
  // ⚠️ อย่าเอา "เฉลี่ยต่อลูกค้า" มาวางเป็นแท่งคู่บนแกนเดียวกัน: ยอดสะสมสูงสุด ฿47M แต่ค่าเฉลี่ยแค่ ฿1.4–4.2M
  //    ต่างกัน ~30 เท่า → แท่งเฉลี่ยเตี้ยติดพื้นจนอ่านไม่ออก (ลองแล้ว) · ตัวเลขเฉลี่ยดูได้ที่ตารางด้านล่าง
  const revenueByDealer = (() => {
    const m = new Map<string, { revenue: number; count: number }>();
    rows.forEach(r => {
      const v = m.get(r.dealerCode) ?? { revenue: 0, count: 0 };
      v.revenue += r.totalRevenue; v.count += 1;
      m.set(r.dealerCode, v);
    });
    return [...m.entries()]
      .map(([code, v]) => ({ code, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  })();
  const toM = (v: number) => Math.round(v / 1e5) / 10; // บาท → ล้านบาท (ทศนิยม 1 ตำแหน่ง)

  // 4 · จังหวัด (10 อันดับแรก)
  const byProvince = countCustomers(rows, r => (r.province ? [r.province] : [])).slice(0, 10);

  // 5 · แม่แบบย่อย — ใบที่ระบุแค่แม่แบบหลักจะไม่นับ (ไม่มีแม่แบบย่อยจริง)
  const bySubtype = countCustomers(rows, r => r.templates);

  const cnt = (v: number) => `${v} ราย`;

  return (
    <div className="hq-cust-charts">
      <Card title="ลูกค้า ตามประเภทอาคาร" hint="แม่แบบหลัก · นับจากอาคารที่ซื้อแล้ว">
        <HBar rows={byType} fmt={cnt} empty="ยังไม่มีลูกค้าที่ปิดการขายในผลกรองนี้" unit="ประเภท" />
      </Card>

      <Card title="ลูกค้า ตามตัวแทน" hint="สัดส่วนลูกค้าในฐานข้อมูล">
        {!dealerTotal ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut segments={dealerDonut} centerLabel="ลูกค้า" centerValue={`${dealerTotal}`} size={150} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {dealerDonut.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.7rem" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
                  <span style={{ color: "var(--muted-foreground)", minWidth: 32, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(s.value / dealerTotal * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="ยอดซื้อ ตามตัวแทน" hint="ยอดซื้อสะสม · หน่วย: ล้านบาท · ชี้ที่แท่งเพื่อดูตัวเลข">
        {!revenueByDealer.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : (
          <GroupedBarChart
            months={revenueByDealer.map(d => d.code)}
            vw={560} height={244}
            fmt={v => `${v.toFixed(1)}M`}
            series={[{ name: "ยอดซื้อสะสม", color: "#0891B2", data: revenueByDealer.map(d => toM(d.revenue)) }]}
          />
        )}
      </Card>

      <Card title="ลูกค้า ตามจังหวัด" hint="10 อันดับแรก">
        <HBar rows={byProvince} fmt={cnt} color="#6366F1" unit="จังหวัด" />
      </Card>

      <Card title="ลูกค้า ตามแม่แบบย่อย" hint="เฉพาะใบที่ระบุแม่แบบย่อย">
        <HBar rows={bySubtype} fmt={cnt} color="#7C3AED" empty="ไม่มีใบที่ระบุแม่แบบย่อยในผลกรองนี้" unit="แม่แบบ" />
      </Card>

    </div>
  );
}
