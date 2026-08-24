"use client";

// ─── ตัวกรองใบเสนอราคาทั้งเครือ (Sticky) ──────────────────────────────────────
// ค้นหา: เลขที่ / ตัวแทน / รหัสตัวแทน / ลูกค้า
// ตัวเลือก: ตัวแทน · ภูมิภาค · จังหวัดตัวแทน · ประเภทอาคาร · สถานะ
// (ตัวกรอง "ช่วงมูลค่า" ถูกลบทั้งฟีเจอร์ตามที่บอสสั่ง — อย่าใส่กลับ)
// หมายเหตุ: "จังหวัด" = จังหวัดของตัวแทนที่ออกใบ ไม่ใช่จังหวัดลูกค้า/หน้างาน
// (ใบเสนอราคาไม่เก็บจังหวัดของตัวเอง — ป้ายบนตัวเลือกจึงต้องเขียนว่า "จังหวัดตัวแทน" ให้ชัด)
import { Search, X } from "lucide-react";
import { quotationStatusLabel, type QuotationStatus } from "@pms/shared/lib/mock";
import { regionDisplay } from "@pms/shared/lib/hqQuotations";

const MUTED = "#6b7280";

export type QuotationFilters = {
  search: string;
  dealer: string;
  region: string;
  province: string;
  product: string;
  status: QuotationStatus | "all";
};

export const EMPTY_FILTERS: QuotationFilters = {
  search: "", dealer: "all", region: "all", province: "all", product: "all", status: "all",
};

export function QuotationFilterBar({
  filters, onChange, dealers, regions, provinces, products, }: {
  filters: QuotationFilters;
  onChange: (f: QuotationFilters) => void;
  dealers: { code: string; name: string }[];
  regions: string[];
  provinces: string[];
  products: string[];
}) {
  const set = <K extends keyof QuotationFilters>(k: K, v: QuotationFilters[K]) => onChange({ ...filters, [k]: v });
  const dirty = filters.search !== "" || filters.dealer !== "all" || filters.region !== "all"
    || filters.province !== "all" || filters.product !== "all" || filters.status !== "all";

  return (
    <div className="card hq-sticky-filter" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem", padding: "10px 14px" }}>
      {/* ใช้ .search-bar ตัวมาตรฐาน (280px) ให้เท่ากับทุกหน้า — เดิมหน้านี้ประกอบเองกว้าง 300 */}
      <div className="search-bar">
        <Search size={14} color={MUTED} strokeWidth={2} />
        <input
          type="text"
          placeholder="ค้นหาเลขที่ / ลูกค้า / ตัวแทน / รหัสตัวแทน..."
          value={filters.search}
          onChange={e => set("search", e.target.value)}
        />
      </div>

      <div style={{ flex: 1 }} />


      <select aria-label="กรองตามตัวแทน" value={filters.dealer} onChange={e => set("dealer", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกตัวแทน</option>
        {dealers.map(d => <option key={d.code} value={d.code}>{d.code} – {d.name}</option>)}
      </select>

      <select aria-label="กรองตามภูมิภาค" value={filters.region} onChange={e => set("region", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกภูมิภาค</option>
        {regions.map(r => <option key={r} value={r}>{regionDisplay(r)}</option>)}
      </select>

      {/* ป้ายเขียน "จังหวัดตัวแทน" ชัด ๆ — กันเข้าใจผิดว่าเป็นจังหวัดของลูกค้า */}
      <select value={filters.province} onChange={e => set("province", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }} aria-label="จังหวัดตัวแทน">
        <option value="all">ทุกจังหวัด (ตัวแทน)</option>
        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <select aria-label="กรองตามแม่แบบ" value={filters.product} onChange={e => set("product", e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกประเภทอาคาร (จากใบเสนอราคา)</option>
        {products.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <select aria-label="กรองตามสถานะใบเสนอราคา" value={filters.status} onChange={e => set("status", e.target.value as QuotationFilters["status"])} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
        <option value="all">ทุกสถานะ</option>
        {(Object.keys(quotationStatusLabel) as QuotationStatus[]).map(s => (
          <option key={s} value={s}>{quotationStatusLabel[s]}</option>
        ))}
      </select>


      {dirty && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
          <X size={13} /> ล้างตัวกรอง
        </button>
      )}
    </div>
  );
}
