"use client";

// ─── #5 แนวโน้มใบเสนอราคารายเดือน (ย้อนหลัง 12 เดือน) ─────────────────────────
// ไม่ขึ้นกับตัวกรองช่วงเวลา — ถ้าอิงตัวกรอง (เช่น "เดือนนี้") กราฟ 12 เดือนจะว่าง 11 ช่อง
// ยังอิงตัวกรองอื่น (ตัวแทน/ภูมิภาค/ประเภทอาคาร/สถานะ) ตามปกติ
import { BarLineChart } from "@/components/ui/Charts";
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
    // ไม่ตรึงความสูงด้วย .chart-* — การ์ดนี้เป็น SVG ที่ยืดตามความกว้าง
    // ถ้าตรึงแล้วให้เลื่อน = กราฟเส้นโดนตัดครึ่ง (อ่านไม่ได้) ต้องคุมที่สัดส่วน viewBox แทน
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">แนวโน้มใบเสนอราคารายเดือน</div>
          <div className="card-desc">ย้อนหลัง 12 เดือน — ไม่ขึ้นกับตัวกรองช่วงเวลา</div>
        </div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ใบ</span>
      </div>
      <div className="card-body" style={{ paddingTop: 6 }}>
        {/* vw ต้องใกล้ความกว้างการ์ดจริง ไม่งั้น SVG ถูกสเกลทั้งใบ (ตัวอักษร/เส้นใหญ่ผิดส่วน และการ์ดสูงเกิน)
            การ์ดนี้กินเต็มแถว ≈ 1,130px — เดิมส่ง 560 (ค่าสมัยยังอยู่ในกริด 2 คอลัมน์)
            SVG เลยถูกขยาย 2 เท่า สูง 564px แทนที่จะเป็น 280px */}
        {/* แท่ง = ใบที่สร้างทั้งหมด · เส้น = ใบที่ตอบรับ (สับเซตของแท่ง)
            ช่องว่างระหว่างเส้นกับหัวแท่ง = ใบที่ยังไม่ปิดหรือปิดไม่ได้ในเดือนนั้น */}
        <BarLineChart
          months={slots.map(s => s.label)}
          vw={1130}
          height={280}
          fmt={v => `${Math.round(v)}`}
          bar={{ name: "ใบเสนอราคาที่สร้าง", color: "#003366", data: countIn(() => true) }}
          line={{ name: "ตอบรับ", color: "#059669", data: countIn(r => r.status === "won") }}
        />
      </div>
    </div>
  );
}
