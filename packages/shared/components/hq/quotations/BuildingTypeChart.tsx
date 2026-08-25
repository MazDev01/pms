"use client";

// ─── #5 ประเภทอาคาร ───────────────────────────────────────────────────────────
// ใบเสนอราคาส่วนใหญ่เป็นอาคารประเภทใด — จัดกลุ่มด้วยแม่แบบหลัก (mainTemplateOf)
// เพื่อรวมชนิดย่อย เช่น "โรงงานอาหาร" → "โรงงาน" ให้เป็นกลุ่มเดียวกัน
import { fmtBaht } from "@pms/shared/lib/format";

const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0f766e", "#b45309"];

// types = จัดกลุ่มตามแม่แบบหลัก (mainTemplateOf) มาแล้ว เรียงตามจำนวนใบ — คำนวณที่ DB (M9 Phase 2) หรือฝั่ง client (local)
export function BuildingTypeChart({ types }: { types: { type: string; count: number; value: number }[] }) {
  const max = Math.max(...types.map(t => t.count), 1);

  // chart-m = สูงเท่า "เทียบรายภูมิภาค" ที่จับคู่กันในแถวเดียวกัน (รายการยาวเกินก็เลื่อนในใบ)
  return (
    <div className="card chart-m" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">ประเภทอาคาร</div>
        </div>
        <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>จำนวนใบ · มูลค่า</span>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
        {!types.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : types.map((t, i) => (
          <div key={t.type}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#374151", fontWeight: 600, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: RAMP[i % RAMP.length], flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.type}</span>
              </span>
              <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontWeight: 800, color: "#1F2937" }}>{t.count} ใบ</span>
                <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{fmtBaht(t.value)}</span>
              </span>
            </div>
            <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
              <div className="bar-grow" style={{ height: "100%", width: `${Math.round(t.count / max * 100)}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
