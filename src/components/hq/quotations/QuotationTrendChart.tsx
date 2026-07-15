"use client";

// ─── #5 แนวโน้มใบเสนอราคารายเดือน (ย้อนหลัง 12 เดือน) ─────────────────────────
// ไม่ขึ้นกับตัวกรองช่วงเวลา — ถ้าอิงตัวกรอง (เช่น "เดือนนี้") กราฟ 12 เดือนจะว่าง 11 ช่อง
// ยังอิงตัวกรองอื่น (ตัวแทน/ภูมิภาค/ประเภทอาคาร/สถานะ) ตามปกติ
import { MultiLineChart } from "@/components/ui/Charts";
import { APP_NOW } from "@/context/FilterContext";
import type { QuoteRow } from "@/lib/hqQuotations";

const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function QuotationTrendChart({ rows }: { rows: QuoteRow[] }) {
  // 12 ช่องย้อนหลังจาก "วันนี้" ของระบบ (มิ.ย. 2569) → ก.ค. 2568 – มิ.ย. 2569
  const slots: { label: string; y: number; m: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(APP_NOW.getFullYear(), APP_NOW.getMonth() - i, 1);
    slots.push({ label: TH_ABBR[d.getMonth()], y: d.getFullYear(), m: d.getMonth() });
  }
  const countIn = (pick: (r: QuoteRow) => boolean) =>
    slots.map(s => rows.filter(r => pick(r) && r.createdDate && r.createdDate.getFullYear() === s.y && r.createdDate.getMonth() === s.m).length);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">แนวโน้มใบเสนอราคารายเดือน</div>
          <div className="card-desc">ย้อนหลัง 12 เดือน — ไม่ขึ้นกับตัวกรองช่วงเวลา</div>
        </div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ใบ</span>
      </div>
      <div className="card-body" style={{ paddingTop: 6 }}>
        <MultiLineChart
          months={slots.map(s => s.label)}
          height={280}
          fmt={v => `${Math.round(v)}`}
          series={[
            { name: "ใบเสนอราคาที่สร้าง", color: "#003366", data: countIn(() => true) },
            { name: "ตอบรับ", color: "#059669", data: countIn(r => r.status === "won") },
          ]}
        />
      </div>
    </div>
  );
}
