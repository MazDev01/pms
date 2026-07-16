"use client";

// ─── #8 เหตุผลที่เสียโอกาสการขาย ──────────────────────────────────────────────
// ⚠️ ที่มาของข้อมูล: ระบบเก็บ "เหตุผลที่เสียโอกาส" ไว้ที่ "ลีด" (ตอนปิดลีดเป็นไม่สำเร็จ)
// ไม่ได้เก็บรายใบเสนอราคา → กราฟนี้จึงนับจากลีดที่ปิดไม่สำเร็จ ไม่ใช่จากใบเสนอราคา
// ต้องกำกับที่มาบนหน้าจอเสมอ ห้ามปล่อยให้เข้าใจว่าเป็นเหตุผลของใบเสนอราคา
// รายการเหตุผล = ค่าที่ HQ ตั้งไว้ (ตั้งค่า › เส้นทางการขาย) — ใช้ร่วมทุกตัวแทน
import { useEffect, useState } from "react";
import { LOST_REASONS, loadLostReasons, type LeadRow } from "@/lib/mock";
import { parseBaht } from "@/lib/format";
import { fmtBaht } from "@/lib/format";

const RAMP = ["#dc2626", "#d97706", "#7c3aed", "#0891b2", "#059669", "#6b7280"];

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

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
          <div className="card-desc">นับจากลีดที่ปิดไม่สำเร็จ ({lost.length} ราย) — ระบบไม่ได้เก็บเหตุผลรายใบเสนอราคา</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
        {!rows.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : rows.map((r, i) => (
          <div key={r.reason}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#374151", fontWeight: 600, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: RAMP[i % RAMP.length], flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</span>
              </span>
              <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontWeight: 800, color: "#1F2937" }}>{r.count} ราย</span>
                <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{fmtBaht(r.value)}</span>
              </span>
            </div>
            <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
              <div className="bar-grow" style={{ height: "100%", width: `${Math.round(r.count / max * 100)}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
            </div>
          </div>
        ))}
        {unspecified > 0 && (
          <div style={{ fontSize: "0.65rem", color: "#9ca3af", borderTop: "1px solid #f2f4f7", paddingTop: 8 }}>
            อีก {unspecified} ราย ไม่ได้ระบุเหตุผล
          </div>
        )}
      </div>
    </div>
  );
}
