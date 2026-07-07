"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check, TrendingUp, TrendingDown } from "lucide-react";
import { useFilters } from "@/context/FilterContext";

const PRIMARY = "#003366";

// ตัวเลือกช่วงวัน (override รายการ์ด)
const DAY_OPTIONS = [5, 10, 20, 30] as const;
export type StatDays = typeof DAY_OPTIONS[number];

/** Stat Card (สไตล์ shadcn statistics) — icon + label + dropdown ช่วงวัน + ตัวเลขเด่น + trend pill
 *  Sync ทางเดียว: ตัวกรองหลัก (FilterBar) เปลี่ยน → การ์ดตามอัตโนมัติ · เลือกช่วงในการ์ด → เฉพาะการ์ดนั้น (หลักไม่เปลี่ยน)
 *  metric(days) คืนค่า { value, trend } ที่คำนวณจากข้อมูลจริงตามจำนวนวัน */
export function StatCard({ icon, label, metric, onClick }: {
  icon: ReactNode;
  label: string;
  metric: (days: number) => { value: string; trend: number };
  onClick?: () => void;
}) {
  const { timeRange } = useFilters();
  // จำนวนวันของตัวกรองหลัก (คำนวณจากช่วงวันที่)
  const globalDays = Math.max(1, Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / 86_400_000) + 1);
  // override เฉพาะการ์ด (null = ตามตัวกรองหลัก)
  const [override, setOverride] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // ตัวกรองหลักเปลี่ยน → ล้าง override → การ์ดกลับไปตามตัวกรองหลัก
  useEffect(() => { setOverride(null); }, [timeRange.start, timeRange.end]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const days = override ?? globalDays;
  const { value, trend } = metric(days);
  const up = trend >= 0;

  return (
    <div className="card" style={{ padding: "16px 18px", cursor: onClick ? "pointer" : "default",
      overflow: "visible", position: "relative", zIndex: open ? 30 : undefined }}
      onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === "Enter") onClick(); } : undefined}>
      {/* header: icon + label · dropdown ช่วงวัน */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "#f0f4f8", color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => setOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontFamily: "inherit",
              fontSize: "0.72rem", fontWeight: 700, color: open ? PRIMARY : "#475569",
              background: open ? "#eef3f8" : "#fff", border: `1px solid ${open ? "#b9cbe2" : "#e5e7eb"}`,
              borderRadius: 8, padding: "5px 10px", transition: "background .12s, border-color .12s, color .12s" }}
            onMouseEnter={e => { if (!open) { const t = e.currentTarget as HTMLElement; t.style.background = "#f5f8fc"; t.style.borderColor = "#cdd8e6"; } }}
            onMouseLeave={e => { if (!open) { const t = e.currentTarget as HTMLElement; t.style.background = "#fff"; t.style.borderColor = "#e5e7eb"; } }}>
            {days} วัน <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 40, minWidth: 120,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.14)", overflow: "hidden", padding: "4px 0" }}>
              {DAY_OPTIONS.map(d => {
                const sel = d === days;
                return (
                  <button key={d} type="button" onClick={() => { setOverride(d); setOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 13px",
                      border: "none", background: sel ? "#f0f6ff" : "#fff", cursor: "pointer", fontFamily: "inherit",
                      fontSize: "0.8rem", fontWeight: sel ? 700 : 400, color: sel ? PRIMARY : "#2D2D2D" }}>
                    {d} วัน {sel && <Check size={14} color={PRIMARY} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* value + trend pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2D2D2D", lineHeight: 1 }}>{value}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, borderRadius: 99, padding: "3px 9px",
          background: "#f0f4f8", fontSize: "0.72rem", fontWeight: 800, color: up ? "#059669" : "#dc2626" }}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : ""}{trend}%
        </span>
      </div>
    </div>
  );
}
