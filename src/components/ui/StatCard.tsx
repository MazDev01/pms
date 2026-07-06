"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check, TrendingUp, TrendingDown } from "lucide-react";

const PRIMARY = "#003366";

// ตัวเลือกช่วงวัน (ต่อการ์ด) — ค่าเริ่มต้น 30 วัน
const DAY_OPTIONS = [5, 10, 20, 30] as const;
export type StatDays = typeof DAY_OPTIONS[number];

/** Stat Card (สไตล์ shadcn statistics) — icon + label + dropdown ช่วงวัน + ตัวเลขเด่น + trend pill
 *  metric(days) คืนค่า { value, trend } ที่คำนวณจากข้อมูลจริงตามช่วงวันที่เลือก */
export function StatCard({ icon, label, metric, onClick, defaultDays = 30 }: {
  icon: ReactNode;
  label: string;
  metric: (days: StatDays) => { value: string; trend: number };
  onClick?: () => void;
  defaultDays?: StatDays;
}) {
  const [days, setDays] = useState<StatDays>(defaultDays);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => setOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280", padding: "2px 4px" }}>
            {days} วัน <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 40, minWidth: 120,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.14)", overflow: "hidden", padding: "4px 0" }}>
              {DAY_OPTIONS.map(d => {
                const sel = d === days;
                return (
                  <button key={d} type="button" onClick={() => { setDays(d); setOpen(false); }}
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
        <span style={{ fontSize: "1.55rem", fontWeight: 800, color: "#2D2D2D", lineHeight: 1 }}>{value}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, borderRadius: 99, padding: "3px 9px",
          background: "#f0f4f8", fontSize: "0.72rem", fontWeight: 800, color: up ? "#059669" : "#dc2626" }}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? "+" : ""}{trend}%
        </span>
      </div>
    </div>
  );
}
