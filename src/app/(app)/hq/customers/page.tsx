"use client";

// ─── HQ · ฐานข้อมูลลูกค้าทั้งเครือ ───────────────────────────────────────────────
// ฐานข้อมูลลูกค้าหลังปิดการขาย — HQ ดูอย่างเดียว (ไม่มี เพิ่ม/แก้ไข/ลบ)
// Data Ownership เป็นของ Benjamin → เจาะดูได้ทุกตัวแทน
//
// ตัวกรอง "ประเภทธุรกิจ (Industry)" และคอลัมน์ "บุคคล/บริษัท" ไม่มีในหน้านี้
// เพราะระบบไม่เก็บข้อมูลสองอย่างนั้น (ตัดออกตามที่ตัดสินไว้ — อย่าใส่กลับโดยไม่มีฟิลด์จริง)
//
// ไม่มีตัวกรองช่วงเวลา (FilterBar) บนหน้านี้ตั้งใจ — นี่คือ "ฐานข้อมูล" ไม่ใช่รายงานรายงวด
// ถ้ากรองด้วยช่วงเวลา ลูกค้าที่ซื้อครั้งสุดท้ายก่อนช่วงนั้นจะหายไปทั้งราย (ตัวเลือกกว้างสุดของ FilterBar
// คือ "ปีนี้" → ลูกค้าที่ซื้อปี 2568 ลงไปจะไม่มีวันแสดง) ความต้องการด้านเวลาใช้ตัวกรอง "ปีที่ส่งมอบ" แทน
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { customerCode } from "@/lib/mock";
import { toThaiDate } from "@/lib/warranty";
import { useCustomerDb, REGIONS, isWarrantyExpiringSoon, type CustomerDbRow } from "@/lib/customerDb";
import { CustomerKPICards } from "@/components/hq/customers/CustomerKPICards";
import { CustomerAnalytics } from "@/components/hq/customers/CustomerAnalytics";
import { CustomerTable } from "@/components/hq/customers/CustomerTable";
import { CustomerDrawer } from "@/components/hq/customers/CustomerDrawer";

type WarrantyFilter = "all" | "active" | "soon" | "expired" | "none";

// ตัวกรองประกันทำงานระดับ "อาคาร" (ลูกค้า 1 รายมีหลายอาคาร สถานะต่างกันได้)
// ป้ายจึงเขียนว่า "มีอาคาร..." ให้ตรงกับที่กรองจริง — คอลัมน์ในตารางแสดงอาคารที่ส่งมอบล่าสุด
const WARRANTY_LABEL: Record<Exclude<WarrantyFilter, "all">, string> = {
  active: "มีอาคารอยู่ในประกัน", soon: "มีอาคารใกล้หมดประกัน", expired: "มีอาคารหมดประกันแล้ว", none: "ยังไม่ส่งมอบ",
};

export default function HQCustomersPage() {
  const source = useCustomerDb();

  // ตัวกรองเฉพาะหน้านี้ (ไม่จำข้ามหน้า) — ช่วงเวลาใช้ FilterBar ส่วนกลาง
  const [search, setSearch] = useState("");
  const [dealerSel, setDealerSel] = useState("all");
  const [regionSel, setRegionSel] = useState("all");
  const [provinceSel, setProvinceSel] = useState("all");
  const [typeSel, setTypeSel] = useState("all");
  const [yearSel, setYearSel] = useState("all");        // ปีที่ส่งมอบ
  const [warrantySel, setWarrantySel] = useState<WarrantyFilter>("all");
  const [viewC, setViewC] = useState<CustomerDbRow | null>(null);

  // ตัวเลือกทุกอันสร้างจากข้อมูลจริงในหน้า — ไม่มีรายการค้างที่ไม่มีข้อมูล
  const dealerOptions = useMemo(() => {
    const m = new Map<string, string>();
    source.forEach(c => m.set(c.dealerCode, c.dealerName));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [source]);

  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    source.forEach(c => { if (c.province && (regionSel === "all" || c.region === regionSel)) set.add(c.province); });
    return [...set].sort((a, b) => a.localeCompare(b, "th"));
  }, [source, regionSel]);

  const typeOptions = useMemo(
    () => [...new Set(source.flatMap(c => c.buildingTypes))].sort((a, b) => a.localeCompare(b, "th")),
    [source],
  );

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    source.forEach(c => c.buildings.forEach(b => b.deliveredAt && set.add(b.deliveredAt.getFullYear() + 543)));
    return [...set].sort((a, b) => b - a);
  }, [source]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return source
      .filter(c => {
        if (q && !c.name.toLowerCase().includes(q) && !c.province.toLowerCase().includes(q)) return false;
        if (dealerSel !== "all" && c.dealerCode !== dealerSel) return false;
        if (regionSel !== "all" && c.region !== regionSel) return false;
        if (provinceSel !== "all" && c.province !== provinceSel) return false;
        if (typeSel !== "all" && !c.buildingTypes.includes(typeSel)) return false;
        if (yearSel !== "all" && !c.buildings.some(b => b.deliveredAt && b.deliveredAt.getFullYear() + 543 === +yearSel)) return false;
        if (warrantySel !== "all") {
          // นับระดับอาคาร ให้ตรงกับกราฟ "สถานะประกัน" — ลูกค้ารายเดียวมีได้ทั้งอาคารที่หมดและยังไม่หมด
          if (warrantySel === "none" && c.buildings.some(b => b.warranty)) return false;
          if (warrantySel === "active" && !c.buildings.some(b => b.warranty?.status === "active")) return false;
          if (warrantySel === "soon" && !c.buildings.some(b => isWarrantyExpiringSoon(b.warranty))) return false;
          if (warrantySel === "expired" && !c.buildings.some(b => b.warranty?.status === "expired")) return false;
        }
        return true;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [source, search, dealerSel, regionSel, provinceSel, typeSel, yearSel, warrantySel]);

  const selectStyle = { width: "auto", cursor: "pointer" } as const;

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p>ฐานข้อมูลลูกค้าทุกตัวแทน · ทั้งหมด {source.length} ราย</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ExportMenu
            filename="hq-customers"
            title="ลูกค้าทั้งเครือ"
            headers={["รหัสลูกค้า", "ลูกค้า", "รหัส", "ชื่อตัวแทน", "จังหวัด", "ภาค", "ประเภทอาคาร", "แม่แบบ", "วันที่ส่งมอบ", "ประกัน", "ยอดซื้อรวม", "ซื้อล่าสุด"]}
            rows={filtered.map(c => [
              customerCode(c.dealerCode, c.localId ?? c.id),
              c.name, c.dealerCode, c.dealerName, c.province, c.region ?? "—",
              c.buildingTypes.join(", ") || "—",
              c.templates.join(", ") || "—",
              c.deliveredAt ? toThaiDate(c.deliveredAt) : "—",
              c.warranty ? (c.warranty.status === "active" ? (isWarrantyExpiringSoon(c.warranty) ? "ใกล้หมด" : "อยู่ในประกัน") : "หมดประกัน") : "—",
              c.totalRevenue,
              c.lastPurchase ?? "—",
            ])}
          />
        </div>
      </div>

      <CustomerKPICards rows={filtered} />

      {/* ตัวกรอง — ค้นหา + ตัวแทน/ภาค/จังหวัด/ประเภทอาคาร/ปีที่ส่งมอบ/ประกัน */}
      <div className="card" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px" }}>
        <div className="search-bar">
          <Search size={14} color="#9ca3af" strokeWidth={2} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า หรือจังหวัด..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />

        <select value={dealerSel} onChange={e => setDealerSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกตัวแทน</option>
          {dealerOptions.map(([code, name]) => <option key={code} value={code}>{code} – {name}</option>)}
        </select>

        <select
          value={regionSel}
          onChange={e => { setRegionSel(e.target.value); setProvinceSel("all"); }}
          className="form-select" style={selectStyle}
        >
          <option value="all">ทุกภาค</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={provinceSel} onChange={e => setProvinceSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกจังหวัด</option>
          {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={typeSel} onChange={e => setTypeSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกประเภทอาคาร</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={yearSel} onChange={e => setYearSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกปีที่ส่งมอบ</option>
          {yearOptions.map(y => <option key={y} value={y}>ส่งมอบปี {y}</option>)}
        </select>

        <select value={warrantySel} onChange={e => setWarrantySel(e.target.value as WarrantyFilter)} className="form-select" style={selectStyle}>
          <option value="all">ทุกสถานะประกัน</option>
          {(Object.keys(WARRANTY_LABEL) as (keyof typeof WARRANTY_LABEL)[]).map(k => (
            <option key={k} value={k}>{WARRANTY_LABEL[k]}</option>
          ))}
        </select>
      </div>

      <CustomerAnalytics rows={filtered} />

      <div className="card">
        <CustomerTable rows={filtered} onView={setViewC} />
        {filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: "#6b7280" }}>
            แสดง {filtered.length} รายการ จากทั้งหมด {source.length} ลูกค้า
          </div>
        )}
      </div>

      <CustomerDrawer row={viewC} onClose={() => setViewC(null)} />
    </div>
  );
}
