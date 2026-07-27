"use client";

// ─── #5 แนวโน้มใบเสนอราคารายเดือน (ย้อนหลัง 12 เดือน) ─────────────────────────
// ไม่ขึ้นกับตัวกรองช่วงเวลา — ถ้าอิงตัวกรอง (เช่น "เดือนนี้") กราฟ 12 เดือนจะว่าง 11 ช่อง
// ยังอิงตัวกรองอื่น (ตัวแทน/ภูมิภาค/ประเภทอาคาร/สถานะ) ตามปกติ
import { BarLineChart } from "@pms/shared/components/ui/Charts";

// trend = 12 ช่องย้อนหลัง (bar=ใบทั้งหมด · line=ตอบรับ) คำนวณมาแล้ว (DB byMonth หรือ client) — M9 Phase 2
export function QuotationTrendChart({ trend }: { trend: { months: string[]; bar: number[]; line: number[] } }) {
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
          months={trend.months}
          vw={1130}
          height={280}
          fmt={v => `${Math.round(v)}`}
          bar={{ name: "ใบเสนอราคาที่สร้าง", color: "#003366", data: trend.bar }}
          line={{ name: "ตอบรับ", color: "#059669", data: trend.line }}
        />
      </div>
    </div>
  );
}
