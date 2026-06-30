"use client";

import {
  createContext, useContext, useState, useMemo, useCallback, useEffect,
  type ReactNode,
} from "react";
import { dealerLeaderboard, hqAllCustomers, customers, quotations } from "@/lib/mock";

/* ────────────────────────────────────────────────────────────────────────────
 * Global Filter / Time Range — ส่วนกลางที่ Dashboard / Reports / Analytics ใช้ร่วมกัน
 * เบาและดูแลง่าย: ใช้วันที่ ISO (YYYY-MM-DD) เท่านั้น ไม่มี parser ที่ซับซ้อน
 * เปลี่ยน filter แล้ว KPI / chart / table อัปเดตทันทีโดยไม่รีโหลดหน้า
 * ────────────────────────────────────────────────────────────────────────── */

// ยึด "วันนี้" ไว้ที่ยุคของข้อมูล mock (30 มิ.ย. 2026)
const APP_NOW = new Date(2026, 5, 30);

const THAI_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ── อ่านวันที่: ISO (YYYY-MM-DD) เท่านั้น ──
export function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// ── แสดงผลวันที่เป็นไทย (เพื่อโชว์ใน UI เท่านั้น ไม่เกี่ยวกับการกรอง) ──
function fmtTH(d: Date): string {
  return `${d.getDate()} ${THAI_MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Time range presets ──
export type TimePreset = "today" | "last7" | "last30" | "thisMonth" | "thisYear" | "custom";

export const TIME_PRESETS: { key: TimePreset; label: string }[] = [
  { key: "today",     label: "วันนี้" },
  { key: "last7",     label: "7 วันล่าสุด" },
  { key: "last30",    label: "30 วันล่าสุด" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "thisYear",  label: "ปีนี้" },
  { key: "custom",    label: "กำหนดเอง" },
];

const PRESET_LABEL: Record<TimePreset, string> = Object.fromEntries(
  TIME_PRESETS.map(p => [p.key, p.label]),
) as Record<TimePreset, string>;

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const x = startOfDay(d); x.setDate(x.getDate() + n); return x; }

export type TimeRange = {
  preset: TimePreset;
  start: Date;       // inclusive
  end: Date;         // inclusive
  label: string;     // สั้น เช่น "30 วันล่าสุด"
  subtitle: string;  // อธิบาย เช่น "1 มิ.ย. 2026 – 30 มิ.ย. 2026"
  factor: number;    // ตัวคูณสำหรับสเกล KPI ที่เป็นตัวเลข hardcode (30 วัน = 1.0)
};

const PRESET_FACTOR: Record<Exclude<TimePreset, "custom">, number> = {
  today: 0.033, last7: 0.23, last30: 1.0, thisMonth: 1.0, thisYear: 5.24,
};

function buildTimeRange(preset: TimePreset, customStart?: string, customEnd?: string): TimeRange {
  const now = startOfDay(APP_NOW);
  const y = now.getFullYear(), m = now.getMonth();
  let start = now, end = now;

  switch (preset) {
    case "today":     start = now; end = now; break;
    case "last7":     start = addDays(now, -6); end = now; break;
    case "last30":    start = addDays(now, -29); end = now; break;
    case "thisMonth": start = new Date(y, m, 1); end = now; break;
    case "thisYear":  start = new Date(y, 0, 1); end = now; break;
    case "custom": {
      const cs = parseDate(customStart) ?? addDays(now, -29);
      const ce = parseDate(customEnd) ?? now;
      start = cs <= ce ? cs : ce;
      end = cs <= ce ? ce : cs;
      break;
    }
  }

  let factor: number;
  if (preset === "custom") {
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    factor = Math.max(0.05, Math.round((days / 30) * 100) / 100);
  } else {
    factor = PRESET_FACTOR[preset];
  }

  const sameDay = start.getTime() === end.getTime();
  const subtitle = sameDay ? fmtTH(start) : `${fmtTH(start)} – ${fmtTH(end)}`;

  return { preset, start, end, label: PRESET_LABEL[preset], subtitle, factor };
}

// ── Option lists (สร้างจากข้อมูลจริง) ──
export const DEALER_OPTIONS: { value: string; label: string }[] =
  dealerLeaderboard.map(d => ({ value: d.code, label: d.name }));

export const PRODUCT_OPTIONS: { value: string; label: string }[] = [
  { value: "EASYBUILD", label: "EASYBUILD" },
  { value: "RANBUILD",  label: "RANBUILD" },
  { value: "PREFAB",    label: "PREFAB" },
  { value: "PEB",       label: "PEB" },
  { value: "CUSTOM",    label: "Custom" },
];

export const PROVINCE_OPTIONS: { value: string; label: string }[] = (() => {
  const set = new Set<string>();
  hqAllCustomers.forEach(c => c.province && set.add(c.province));
  customers.forEach(c => c.province && set.add(c.province));
  quotations.forEach(q => q.province && set.add(q.province));
  return [...set].sort((a, b) => a.localeCompare(b, "th")).map(p => ({ value: p, label: p }));
})();

// ── Filter state ──
export type FilterDim = "dealer" | "province" | "product" | "status";
export const ALL = "all";

type FilterState = {
  preset: TimePreset;
  customStart: string;
  customEnd: string;
  dealer: string;
  province: string;
  product: string;
  status: string;
};

const DEFAULTS: FilterState = {
  preset: "last30", customStart: "", customEnd: "",
  dealer: ALL, province: ALL, product: ALL, status: ALL,
};

const STORAGE_KEY = "bpms_global_filters";

// fields ของ record สำหรับเช็คผ่าน filter — ส่ง undefined = ข้าม dimension นั้น
export type RecordFields = {
  date?: string | null;       // ISO YYYY-MM-DD เท่านั้น
  dealer?: string | null;
  province?: string | null;
  product?: string | null;
  status?: string | null;
};

type Ctx = {
  timeRange: TimeRange;
  dealer: string;
  province: string;
  product: string;
  status: string;
  setPreset: (p: TimePreset) => void;
  setCustomRange: (start: string, end: string) => void;
  setDealer: (v: string) => void;
  setProvince: (v: string) => void;
  setProduct: (v: string) => void;
  setStatus: (v: string) => void;
  setDim: (dim: FilterDim, v: string) => void;
  reset: () => void;
  activeCount: number;
  passes: (f: RecordFields) => boolean;
  inRange: (date?: string | null) => boolean;
};

const FilterContext = createContext<Ctx | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(DEFAULTS);

  // คงค่า filter ไว้ระหว่าง navigate / refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState(s => ({ ...s, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const timeRange = useMemo(
    () => buildTimeRange(state.preset, state.customStart, state.customEnd),
    [state.preset, state.customStart, state.customEnd],
  );

  const setPreset = useCallback((p: TimePreset) => setState(s => ({ ...s, preset: p })), []);
  const setCustomRange = useCallback((start: string, end: string) =>
    setState(s => ({ ...s, preset: "custom", customStart: start, customEnd: end })), []);
  const setDealer = useCallback((v: string) => setState(s => ({ ...s, dealer: v })), []);
  const setProvince = useCallback((v: string) => setState(s => ({ ...s, province: v })), []);
  const setProduct = useCallback((v: string) => setState(s => ({ ...s, product: v })), []);
  const setStatus = useCallback((v: string) => setState(s => ({ ...s, status: v })), []);
  const setDim = useCallback((dim: FilterDim, v: string) => setState(s => ({ ...s, [dim]: v })), []);
  const reset = useCallback(() => setState(DEFAULTS), []);

  const inRange = useCallback((date?: string | null) => {
    if (date === undefined || date === null || date === "") return true;
    const d = parseDate(date);
    if (!d) return true; // ไม่ใช่ ISO → ไม่ตัดออก
    return d.getTime() >= timeRange.start.getTime() && d.getTime() <= timeRange.end.getTime();
  }, [timeRange]);

  const passes = useCallback((f: RecordFields) => {
    if (f.date !== undefined && !inRange(f.date)) return false;
    if (state.dealer !== ALL && f.dealer != null && f.dealer !== state.dealer) return false;
    if (state.province !== ALL && f.province != null && f.province !== state.province) return false;
    if (state.product !== ALL && f.product != null &&
        f.product.toUpperCase() !== state.product.toUpperCase()) return false;
    if (state.status !== ALL && f.status != null && f.status !== state.status) return false;
    return true;
  }, [inRange, state.dealer, state.province, state.product, state.status]);

  const activeCount =
    (state.dealer !== ALL ? 1 : 0) + (state.province !== ALL ? 1 : 0) +
    (state.product !== ALL ? 1 : 0) + (state.status !== ALL ? 1 : 0);

  const value: Ctx = {
    timeRange,
    dealer: state.dealer, province: state.province, product: state.product, status: state.status,
    setPreset, setCustomRange, setDealer, setProvince, setProduct, setStatus, setDim, reset,
    activeCount, passes, inRange,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used inside FilterProvider");
  return ctx;
}
