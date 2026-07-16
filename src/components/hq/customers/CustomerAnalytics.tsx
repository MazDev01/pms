"use client";

// ─── กราฟวิเคราะห์ฐานข้อมูลลูกค้า ────────────────────────────────────────────────
// ทุกกราฟนับจาก "ใบเสนอราคาที่ปิดการขายได้" ของลูกค้าในผลกรอง
// ลูกค้าที่ไม่มีใบปิดการขาย จะไม่ปรากฏในกราฟที่เกี่ยวกับอาคาร (ไม่ใช่การซ่อน — ไม่มีข้อมูลจริง)
import { LineTrendChart } from "@/components/ui/Charts";
import { fmtBaht } from "@/lib/format";
import { TODAY } from "@/lib/warranty";
import { isWarrantyExpiringSoon, type CustomerDbRow } from "@/lib/customerDb";

const PRIMARY = "#003366";
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

type HRow = { label: string; value: number; note?: string };

/** แท่งแนวนอน — เติมจากซ้าย (.bar-grow) ตามมาตรฐานแถบของระบบ */
function HBar({ rows, fmt, color = PRIMARY, empty = "—" }: {
  rows: HRow[]; fmt: (v: number) => string; color?: string; empty?: string;
}) {
  const max = Math.max(...rows.map(r => r.value), 0);
  if (!rows.length || max <= 0) return <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>{empty}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
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

  // 3 · รายได้ตามตัวแทน (+ ยอดเฉลี่ยต่อลูกค้าเป็นหมายเหตุ)
  const revenueByDealer = (() => {
    const m = new Map<string, { revenue: number; count: number }>();
    rows.forEach(r => {
      const k = `${r.dealerCode} · ${r.dealerName}`;
      const v = m.get(k) ?? { revenue: 0, count: 0 };
      v.revenue += r.totalRevenue; v.count += 1;
      m.set(k, v);
    });
    return [...m.entries()]
      .map(([label, v]) => ({ label, value: v.revenue, note: `เฉลี่ย ${fmtBaht(v.count ? v.revenue / v.count : 0)}` }))
      .sort((a, b) => b.value - a.value);
  })();

  // 4 · จังหวัด (10 อันดับแรก)
  const byProvince = countCustomers(rows, r => (r.province ? [r.province] : [])).slice(0, 10);

  // 5 · แม่แบบย่อย — ใบที่ระบุแค่แม่แบบหลักจะไม่นับ (ไม่มีแม่แบบย่อยจริง)
  const bySubtype = countCustomers(rows, r => r.templates);

  // 6 · การส่งมอบย้อนหลัง 12 เดือน (นับรายอาคาร)
  const deliveryTrend = (() => {
    const months: { month: string; value: number; y: number; m: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
      months.push({ month: TH_ABBR[d.getMonth()], value: 0, y: d.getFullYear(), m: d.getMonth() });
    }
    rows.flatMap(r => r.buildings).forEach(b => {
      if (!b.deliveredAt) return;
      const hit = months.find(x => x.y === b.deliveredAt!.getFullYear() && x.m === b.deliveredAt!.getMonth());
      if (hit) hit.value += 1;
    });
    return months.map(({ month, value }) => ({ month, value }));
  })();
  const hasDelivery = deliveryTrend.some(d => d.value > 0);

  // 7 · สถานะประกัน (นับรายอาคาร) — "ใกล้หมดประกัน" เป็นส่วนหนึ่งของที่ยังคุ้มครองอยู่
  const buildings = rows.flatMap(r => r.buildings).filter(b => b.warranty);
  const warrantyRows: HRow[] = [
    { label: "อยู่ในประกัน", value: buildings.filter(b => b.warranty!.status === "active").length },
    { label: "ใกล้หมดประกัน (ภายใน 12 เดือน)", value: buildings.filter(b => isWarrantyExpiringSoon(b.warranty)).length },
    { label: "หมดประกันแล้ว", value: buildings.filter(b => b.warranty!.status === "expired").length },
  ];

  const cnt = (v: number) => `${v} ราย`;

  return (
    <div className="hq-cust-charts">
      <Card title="ลูกค้า ตามประเภทอาคาร" hint="แม่แบบหลัก · นับจากอาคารที่ซื้อแล้ว">
        <HBar rows={byType} fmt={cnt} empty="ยังไม่มีลูกค้าที่ปิดการขายในผลกรองนี้" />
      </Card>

      <Card title="ลูกค้า ตามตัวแทน" hint="จำนวนลูกค้าในฐานข้อมูล">
        <HBar rows={byDealer} fmt={cnt} />
      </Card>

      <Card title="ยอดซื้อ ตามตัวแทน" hint="ยอดซื้อสะสม · เฉลี่ยต่อลูกค้า">
        <HBar rows={revenueByDealer} fmt={fmtBaht} color="#0891B2" />
      </Card>

      <Card title="ลูกค้า ตามจังหวัด" hint="10 อันดับแรก">
        <HBar rows={byProvince} fmt={cnt} color="#6366F1" />
      </Card>

      <Card title="ลูกค้า ตามแม่แบบย่อย" hint="เฉพาะใบที่ระบุแม่แบบย่อย">
        <HBar rows={bySubtype} fmt={cnt} color="#7C3AED" empty="ไม่มีใบที่ระบุแม่แบบย่อยในผลกรองนี้" />
      </Card>

      <Card title="สถานะประกัน" hint="นับรายอาคาร · ประกัน 10 ปีจากวันส่งมอบ">
        <HBar rows={warrantyRows} fmt={v => `${v} อาคาร`} color="#0D9488" empty="ยังไม่มีอาคารที่ส่งมอบในผลกรองนี้" />
      </Card>

      <div style={{ gridColumn: "1 / -1" }}>
        <Card title="การส่งมอบ ย้อนหลัง 12 เดือน" hint="จำนวนอาคารที่ส่งมอบรายเดือน">
          {hasDelivery
            ? <LineTrendChart data={deliveryTrend} unit="" height={260} />
            : <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>ไม่มีการส่งมอบใน 12 เดือนที่ผ่านมาสำหรับผลกรองนี้</div>}
        </Card>
      </div>
    </div>
  );
}
