"use client";

// ─── ตัวกรองใบเสนอราคาทั้งเครือ (Sticky) ──────────────────────────────────────
// ค้นหา: เลขที่ / ตัวแทน / รหัสตัวแทน / ลูกค้า · ตัวเลือก: ตัวแทน · ภูมิภาค · ประเภทอาคาร · สถานะ
// หมายเหตุ: ไม่มีตัวกรอง "จังหวัด" เพราะใบเสนอราคาไม่ได้เก็บจังหวัดไว้ (ภูมิภาคดึงจากตัวแทนที่ออกใบ)
import { Search, X } from "lucide-react";
import { quotationStatusLabel, type QuotationStatus } from "@/lib/mock";
import { regionDisplay } from "@/lib/hqQuotations";
import { FilterBar } from "@/components/filters/FilterBar";

const MUTED = "#6b7280";

export type QuotationFilters = {
  search: string;
  dealer: string;
  region: string;
  product: string;
  status: QuotationStatus | "all";
};

export const EMPTY_FILTERS: QuotationFilters = { search: "", dealer: "all", region: "all", product: "all", status: "all" };

export function QuotationFilterBar({
  filters, onChange, dealers, regions, products, resultCount,
}: {
  filters: QuotationFilters;
  onChange: (f: QuotationFilters) => void;
  dealers: { code: string; name: string }[];
  regions: string[];
  products: string[];
  resultCount: number;
}) {
  const set = <K extends keyof QuotationFilters>(k: K, v: QuotationFilters[K]) => onChange({ ...filters, [k]: v });
  const dirty = filters.search !== "" || filters.dealer !== "all" || filters.region !== "all" || filters.product !== "all" || filters.status !== "all";

  return (
    <div className="card hq-sticky-filter" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem", padding: "10px 14px" }}>
      <div style={{ position: "relative", width: 300, maxWidth: "100%", flexShrink: 0 }}>
        <Search size={14} color={MUTED} strokeWidth={2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="ค้นหาเลขที่ / ลูกค้า / ตัวแทน / รหัสตัวแทน..."
          value={filters.search}
          onChange={e => set("search", e.target.value)}
          className="form-input"
          style={{ paddingLeft: 32 }}
        />
      </div>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>{resultCount} ใบ</span>

      <select value={filters.dealer} onChange={e => set("dealer", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกตัวแทน</option>
        {dealers.map(d => <option key={d.code} value={d.code}>{d.code} – {d.name}</option>)}
      </select>

      <select value={filters.region} onChange={e => set("region", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกภูมิภาค</option>
        {regions.map(r => <option key={r} value={r}>{regionDisplay(r)}</option>)}
      </select>

      <select value={filters.product} onChange={e => set("product", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกประเภทอาคาร</option>
        {products.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <select value={filters.status} onChange={e => set("status", e.target.value as QuotationFilters["status"])} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกสถานะ</option>
        {(Object.keys(quotationStatusLabel) as QuotationStatus[]).map(s => (
          <option key={s} value={s}>{quotationStatusLabel[s]}</option>
        ))}
      </select>

      <FilterBar dims={[]} />

      {dirty && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
          <X size={13} /> ล้างตัวกรอง
        </button>
      )}
    </div>
  );
}
