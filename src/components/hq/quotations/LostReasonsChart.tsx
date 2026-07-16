"use client";

// ─── #8 เหตุผลที่เสียโอกาสการขาย ──────────────────────────────────────────────
// ⚠️ ที่มาของข้อมูล: ระบบเก็บ "เหตุผลที่เสียโอกาส" ไว้ที่ "ลีด" (ตอนปิดลีดเป็นไม่สำเร็จ)
// ไม่ได้เก็บรายใบเสนอราคา → กราฟนี้จึงนับจากลีดที่ปิดไม่สำเร็จ ไม่ใช่จากใบเสนอราคา
// ต้องกำกับที่มาบนหน้าจอเสมอ ห้ามปล่อยให้เข้าใจว่าเป็นเหตุผลของใบเสนอราคา
// รายการเหตุผล = ค่าที่ HQ ตั้งไว้ (ตั้งค่า › เส้นทางการขาย) — ใช้ร่วมทุกตัวแทน
import { useEffect, useState } from "react";
import { LOST_REASONS, loadLostReasons, type LeadRow } from "@/lib/mock";
import { parseBaht, fmtBaht } from "@/lib/format";
import { Donut } from "@/components/ui/Charts";

// โทนแดง-ส้ม ชุดเดียวกับโดนัท "เหตุผล" ที่ /hq/leads และ /hq/pipeline
const RAMP = ["#dc2626", "#ea580c", "#d97706", "#b45309", "#9f1239", "#7c2d12"];

export function LostReasonsChart({ leads }: { leads: LeadRow[] }) {
  // รายการเหตุผลอยู่ใน localStorage → อ่านหลัง mount (กัน hydration mismatch)
  const [reasons, setReasons] = useState<string[]>([...LOST_REASONS]);
  useEffect(() => { setReasons(loadLostReasons()); }, []);

  const lost = leads.filter(l => l.status === "CANCELLED");
  const rows = reasons.map(reason => {
    const list = lost.filter(l => l.lostReason === reason);
    return { reason, count: list.length, value: list.reduce((s, l) => s + parseBaht(l.value), 0) };
  }).filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // ลีดที่ปิดไม่สำเร็จแต่ไม่ได้ระบุเหตุผล (หรือระบุค่านอกรายการของ HQ) — แสดงแยก ไม่ยัดรวมกับ "อื่นๆ"
  const unspecified = lost.filter(l => !l.lostReason || !reasons.includes(l.lostReason)).length;
  const max = Math.max(...rows.map(r => r.count), 1);

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
          <div className="card-desc">นับจากลีดที่ปิดไม่สำเร็จ ({lost.length} ราย) — ระบบไม่ได้เก็บเหตุผลรายใบเสนอราคา</div>
        </div>
      </div>
      {/* โดนัท: เหตุผลรวมกัน = ลีดที่เสียโอกาสทั้งหมดพอดี → เป็นสัดส่วนของก้อนเดียว
          (ชุดสี/รูปแบบเดียวกับ /hq/leads และ /hq/pipeline ให้อ่านเหมือนกันทั้งระบบ) */}
      <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {!rows.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
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
                {/* มูลค่ารวมของเหตุผลนั้น — ข้อมูลจริงจากลีด ไม่ตัดทิ้งตอนเปลี่ยนเป็นโดนัท */}
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
