"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown, Check, X } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import {
  useFilters, TIME_PRESETS, type TimePreset, type FilterDim,
  DEALER_OPTIONS, PROVINCE_OPTIONS, PRODUCT_OPTIONS, ALL,
} from "@/context/FilterContext";

type Opt = { value: string; label: string };

// ลำดับ preset (จัด 2 คอลัมน์ ไม่ต้องมีหัวข้อกลุ่ม)
const PRESET_ORDER: TimePreset[] = ["today", "last7", "last30", "thisMonth", "thisYear"];

function useClickOutside(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [cb]);
  return ref;
}

/* ── ปุ่ม trigger (ชิปบรรทัดเดียว ใช้สไตล์ปุ่มของระบบ) ── */
function Trigger({ icon, label, active, open, onClick }: {
  icon?: React.ReactNode; label: string; active?: boolean; open: boolean; onClick: () => void;
}) {
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={onClick}
      style={{
        gap: 6,
        ...(active
          ? { background: "var(--accent)", borderColor: "var(--primary)", color: "var(--primary)" }
          : {}),
      }}
    >
      {icon}
      <span style={{ fontWeight: 700, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <ChevronDown size={13} style={{ opacity: 0.55, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
    </button>
  );
}

/* ── เมนู dropdown (ใช้ .card ของระบบ) ── */
function Menu({ children, width = 220 }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="card" style={{
      position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
      minWidth: width, boxShadow: "var(--shadow-lg)", overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function MenuItem({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px",
        background: selected ? "var(--accent)" : "transparent", border: "none",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        fontSize: "0.8rem", fontWeight: selected ? 700 : 400,
        color: selected ? "var(--primary)" : "var(--color-sub)",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#f8f9fb"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <Check size={13} style={{ color: selected ? "var(--primary)" : "transparent", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

/* ── Time Range ── */
function TimeRangePicker() {
  const { timeRange, setPreset, setCustomRange } = useFilters();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [cs, setCs] = useState("");
  const [ce, setCe] = useState("");
  const ref = useClickOutside(() => { setOpen(false); setShowCustom(false); });

  function applyCustom() {
    if (cs && ce) { setCustomRange(cs, ce); setOpen(false); setShowCustom(false); }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Trigger
        icon={<CalendarDays size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
        label={timeRange.label} active open={open}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <Menu width={272}>
          {/* ช่วงวันที่ปัจจุบัน บรรทัดเดียว */}
          <div style={{
            padding: "8px 13px", borderBottom: "1px solid var(--border)",
            fontSize: "0.66rem", fontWeight: 600, color: "var(--muted-foreground)",
          }}>
            {timeRange.subtitle}
          </div>

          {/* ตารางปุ่ม preset 2 คอลัมน์ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 10 }}>
            {PRESET_ORDER.map(k => {
              const opt = TIME_PRESETS.find(p => p.key === k)!;
              const sel = timeRange.preset === k;
              return (
                <button key={k} onClick={() => { setPreset(k); setOpen(false); }}
                  style={{
                    padding: "7px 9px", borderRadius: "var(--radius-md)", fontSize: "0.76rem",
                    fontWeight: sel ? 700 : 500, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                    border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                    background: sel ? "var(--accent)" : "var(--card)",
                    color: sel ? "var(--primary)" : "var(--foreground)", transition: "all .12s",
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#f8f9fb"; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "var(--card)"; }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* กำหนดเอง — ซ่อนช่องไว้ เปิดเมื่อกด */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "6px 10px 10px" }}>
            <button onClick={() => setShowCustom(s => !s)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                padding: "6px 3px", fontSize: "0.76rem", fontWeight: 600,
                color: timeRange.preset === "custom" ? "var(--primary)" : "var(--foreground)",
              }}>
              <span>กำหนดช่วงเอง</span>
              <ChevronDown size={13} style={{ opacity: 0.55, transform: showCustom ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {showCustom && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 5 }}>
                <input type="date" className="form-input" value={cs} onChange={e => setCs(e.target.value)} />
                <input type="date" className="form-input" value={ce} onChange={e => setCe(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={applyCustom} disabled={!cs || !ce}
                  style={{ justifyContent: "center", ...(!cs || !ce ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}>
                  ใช้ช่วงเวลานี้
                </button>
              </div>
            )}
          </div>
        </Menu>
      )}
    </div>
  );
}

/* ── Dropdown filter ทั่วไป (dealer / province / product / status) ── */
function SelectFilter({ caption, value, options, onChange }: {
  caption: string; value: string; options: Opt[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const active = value !== ALL;
  const label = active ? (options.find(o => o.value === value)?.label ?? value) : caption;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Trigger label={label} active={active} open={open} onClick={() => setOpen(o => !o)} />
      {open && (
        <Menu>
          <div style={{ maxHeight: 300, overflowY: "auto", padding: "4px 0" }}>
            <MenuItem selected={value === ALL} label={`${caption}ทั้งหมด`} onClick={() => { onChange(ALL); setOpen(false); }} />
            {options.map(o => (
              <MenuItem key={o.value} selected={value === o.value} label={o.label}
                onClick={() => { onChange(o.value); setOpen(false); }} />
            ))}
          </div>
        </Menu>
      )}
    </div>
  );
}

export type FilterBarProps = {
  /** dimension ที่จะแสดง (นอกจาก time range) — ถ้าไม่ระบุจะ default ตาม role */
  dims?: FilterDim[];
  statusOptions?: Opt[];
  productOptions?: Opt[];
  provinceOptions?: Opt[];
  dealerOptions?: Opt[];
  style?: React.CSSProperties;
};

export function FilterBar({
  dims, statusOptions, productOptions, provinceOptions, dealerOptions, style,
}: FilterBarProps) {
  const { isHQ } = useRole();
  const {
    dealer, province, product, status,
    setDealer, setProvince, setProduct, setStatus,
    activeCount, reset,
  } = useFilters();

  const defaultDims: FilterDim[] = isHQ
    ? ["dealer", "province", "product", "status"]
    : ["product", "status"];
  const show = dims ?? defaultDims;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      justifyContent: "flex-end", ...style,
    }}>
      <TimeRangePicker />

      {show.includes("dealer") && (
        <SelectFilter caption="ตัวแทน" value={dealer}
          options={dealerOptions ?? DEALER_OPTIONS} onChange={setDealer} />
      )}
      {show.includes("province") && (
        <SelectFilter caption="จังหวัด" value={province}
          options={provinceOptions ?? PROVINCE_OPTIONS} onChange={setProvince} />
      )}
      {show.includes("product") && (
        <SelectFilter caption="สินค้า" value={product}
          options={productOptions ?? PRODUCT_OPTIONS} onChange={setProduct} />
      )}
      {show.includes("status") && statusOptions && statusOptions.length > 0 && (
        <SelectFilter caption="สถานะ" value={status}
          options={statusOptions} onChange={setStatus} />
      )}

      {activeCount > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={reset} style={{ gap: 4 }}>
          <X size={13} /> ล้างตัวกรอง
        </button>
      )}
    </div>
  );
}
