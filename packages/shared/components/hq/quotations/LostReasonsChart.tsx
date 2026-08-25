"use client";

// ─── #8 เหตุผลที่เสียโอกาสการขาย ──────────────────────────────────────────────
// ⚠️ ที่มาของข้อมูล: ระบบเก็บ "เหตุผลที่เสียโอกาส" ไว้ที่ "ลูกค้าเป้าหมาย" (ตอนปิดลูกค้าเป้าหมายเป็นไม่สำเร็จ)
// ไม่ได้เก็บรายใบเสนอราคา → กราฟนี้จึงนับจากลูกค้าเป้าหมายที่ปิดไม่สำเร็จ ไม่ใช่จากใบเสนอราคา
// ต้องกำกับที่มาบนหน้าจอเสมอ ห้ามปล่อยให้เข้าใจว่าเป็นเหตุผลของใบเสนอราคา
//
// นับจาก "เหตุผลที่ลูกค้าเป้าหมายบันทึกไว้จริง" เท่านั้น — ห้ามเอาไปกรองกับรายการเหตุผลของ HQ (loadLostReasons)
// ของเดิมทำแบบนั้นแล้วพัง: ลูกค้าเป้าหมายในระบบบันทึกคำสั้น ("ราคา") แต่รายการของ HQ เป็นประโยคยาว
// ("ราคาสูงเกินงบประมาณ") → ไม่แมตช์สักอัน → การ์ดขึ้น "—" ทั้งที่มีลูกค้าเป้าหมายปิดไม่สำเร็จ 11 ราย
// รายการของ HQ มีหน้าที่เป็น "ตัวเลือกตอนปิดดีล" เท่านั้น ไม่ใช่ตัวกรองรายงานย้อนหลัง
// (วิธีเดียวกับโดนัทที่ /hq/leads และ /hq/pipeline ซึ่งนับจากข้อมูลจริงและแสดงได้ปกติมาตลอด)
import { fmtBaht } from "@pms/shared/lib/format";
import { withUnspecified } from "@pms/shared/lib/lostReasons";
import { Donut } from "@pms/shared/components/ui/Charts";

// โทนแดง-ส้ม ชุดเดียวกับโดนัท "เหตุผล" ที่ /hq/leads และ /hq/pipeline
const RAMP = ["#dc2626", "#ea580c", "#d97706", "#b45309", "#9f1239", "#7c2d12"];

// reasons = เหตุผล+จำนวน+มูลค่า (จากลูกค้าเป้าหมายปิดไม่สำเร็จที่ระบุเหตุผล) · unspecified = ปิดไม่สำเร็จแต่ไม่ระบุ
// totalLost = ลูกค้าเป้าหมายปิดไม่สำเร็จทั้งหมด · supabase: lead_summary (byLostReason/byStatus) · local: นับจาก leadRows
export function LostReasonsChart({ reasons, unspecified, totalLost }: {
  reasons: { reason: string; count: number; value: number }[];
  unspecified: number;
  totalLost: number;
}) {
  // เติมก้อน "อื่นๆ (ไม่ได้ระบุเหตุผล)" เข้ากราฟด้วย (บอสสั่ง 21 ส.ค. 69)
  //   เดิมบอกไว้เป็นเชิงอรรถใต้การ์ดเท่านั้น ผลรวมของชิ้นในวงจึงไม่เท่ากับจำนวนที่ปิดไม่สำเร็จจริง
  const rows = withUnspecified([...reasons].sort((a, b) => b.count - a.count), unspecified);
  const lost = { length: totalLost };
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
        </div>
      </div>
      {/* โดนัท: เหตุผลรวมกัน = ลูกค้าเป้าหมายที่เสียโอกาสทั้งหมดพอดี → เป็นสัดส่วนของก้อนเดียว
          (ชุดสี/รูปแบบเดียวกับ /hq/leads และ /hq/pipeline ให้อ่านเหมือนกันทั้งระบบ) */}
      <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {!rows.length ? (
          // ว่างได้ 2 แบบ ต้องบอกให้ตรงกัน: ไม่มีลูกค้าเป้าหมายปิดไม่สำเร็จเลย · หรือมีแต่ไม่มีใครระบุเหตุผล
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)", textAlign: "center" }}>
            {unspecified > 0
              ? `— ปิดไม่สำเร็จ ${unspecified} ราย ไม่ได้ระบุเหตุผลไว้`
              : "— ไม่มีลูกค้าเป้าหมายที่ปิดไม่สำเร็จในผลกรองนี้"}
          </div>
        ) : (<>
          <Donut
            segments={rows.map((r, i) => ({ label: r.reason, value: r.count, color: RAMP[i % RAMP.length] }))}
            centerLabel="เสียโอกาส"
            centerValue={`${total}`}
            size={168}
          />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, i) => (
              <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: RAMP[i % RAMP.length], flexShrink: 0 }} />
                <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</span>
                <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                {/* มูลค่ารวมของเหตุผลนั้น — ข้อมูลจริงจากลูกค้าเป้าหมาย ไม่ตัดทิ้งตอนเปลี่ยนเป็นโดนัท */}
                <span style={{ color: "var(--muted-foreground)", fontWeight: 600, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(r.value)}</span>
              </div>
            ))}
            {unspecified > 0 && (
              <div style={{ fontSize: "0.65rem", color: "#9ca3af", borderTop: "1px solid #f2f4f7", paddingTop: 7, marginTop: 1 }}>
                อีก {unspecified} ราย ไม่ได้ระบุเหตุผล
              </div>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
