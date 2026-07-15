"use client";

// ─── กราฟเปรียบเทียบ "รายตัวแทน" — ใช้ซ้ำได้ทุกหน้า HQ ──────────────────────────
// HQ มีหน้าที่ติดตาม/เปรียบเทียบผลตัวแทน → ทุกหน้าที่มีข้อมูลของตัวแทนต้องดูเทียบกันได้
// แท่งแนวนอนเรียงมาก→น้อย · คลิกเจาะรายตัวแทน · ไม่มี funnel/pie/gauge
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

const PRIMARY = "#003366";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];

export type DealerBar = {
  code: string;
  name: string;
  value: number;      // ค่าหลัก — ใช้เรียงและความยาวแท่ง
  note?: string;      // ข้อความรอง (เช่น "12 ใบ")
  compare?: number;   // ค่าเทียบ (เช่น เป้าหมาย) — วาดเป็นแท่งจางด้านหลัง
};

export function DealerChart({
  title, hint, rows, fmt, top = 10, multicolor = false, compareLabel,
}: {
  title: string;
  hint?: string;
  rows: DealerBar[];
  fmt: (v: number) => string;
  top?: number;
  multicolor?: boolean;
  compareLabel?: string;
}) {
  const router = useRouter();
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, top);
  const max = Math.max(...sorted.flatMap(r => [r.value, r.compare ?? 0]), 1);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
        {hint && <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>{hint}</span>}
      </div>
      <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 11 }}>
        {!sorted.length ? (
          <EmptyState icon={<BarChart3 size={26} />} title="ไม่พบข้อมูลตัวแทน" description="ลองปรับตัวกรอง" compact />
        ) : (
          <>
            {sorted.map((d, i) => (
              <div key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)} style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY, marginRight: 6 }}>{d.code}</span>
                    <span style={{ color: "#374151", fontWeight: 600 }}>{d.name}</span>
                  </span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {d.note && <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{d.note}</span>}
                    <span style={{ fontWeight: 800, color: "#1F2937" }}>{fmt(d.value)}</span>
                  </span>
                </div>
                <div style={{ position: "relative", height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  {d.compare != null && (
                    <div style={{ position: "absolute", inset: 0, width: `${Math.round(d.compare / max * 100)}%`, background: "#C0C0C0", opacity: 0.55, borderRadius: 999 }} />
                  )}
                  <div className="bar-grow" style={{ position: "relative", height: "100%", width: `${Math.round(d.value / max * 100)}%`, background: multicolor ? RAMP[i % RAMP.length] : PRIMARY, borderRadius: 999 }} />
                </div>
              </div>
            ))}
            {compareLabel && (
              <div style={{ display: "flex", gap: 14, marginTop: 4, paddingTop: 10, borderTop: "1px solid #f0f4f8", fontSize: "0.68rem", color: "var(--muted-foreground)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 6, borderRadius: 2, background: PRIMARY }} />ทำได้จริง</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 6, borderRadius: 2, background: "#C0C0C0" }} />{compareLabel}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
