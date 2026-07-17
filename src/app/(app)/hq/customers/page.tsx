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
import { toThaiDate } from "@/lib/delivery";
import { useCustomerDb, REGIONS, type CustomerDbRow } from "@/lib/customerDb";
import { CustomerKPICards } from "@/components/hq/customers/CustomerKPICards";
import { CustomerAnalytics } from "@/components/hq/customers/CustomerAnalytics";
import { CustomerTable } from "@/components/hq/customers/CustomerTable";
import { CustomerDrawer } from "@/components/hq/customers/CustomerDrawer";

export default function HQCustomersPage() {
  const source = useCustomerDb();

  // ตัวกรองเฉพาะหน้านี้ (ไม่จำข้ามหน้า) — ช่วงเวลาใช้ FilterBar ส่วนกลาง
  const [search, setSearch] = useState("");
  const [dealerSel, setDealerSel] = useState("all");
  const [regionSel, setRegionSel] = useState("all");
  const [provinceSel, setProvinceSel] = useState("all");
  const [typeSel, setTypeSel] = useState("all");
  const [yearSel, setYearSel] = useState("all");        // ปีที่ส่งมอบ
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
        return true;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [source, search, dealerSel, regionSel, provinceSel, typeSel, yearSel]);

  // ตัวกรอง 5 ช่อง + ช่องค้นหา ต้องอยู่บรรทัดเดียว (แถวนี้ตั้ง flex-wrap: nowrap)
  //   maxWidth — select ที่ width:auto จะกว้างตามตัวเลือกที่ยาวที่สุด (เช่น "RYG – ตัวแทนระยอง สตีล") ต้องคุมเพดาน
  //   minWidth: 0 + flexShrink — ให้ยุบตัวลงได้เมื่อจอแคบ แทนที่จะตกบรรทัด (nowrap ทำให้ยุบก่อน ไม่ใช่ wrap)
  // ขนาดตัวอักษร/ระยะขอบ ใช้สเกลเดียวกับแถบกรองหน้า /hq/pipeline
  const selectStyle = { width: "auto", flex: "0 1 auto", minWidth: 0, maxWidth: 146, padding: "7px 10px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer" } as const;

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
            headers={["รหัสลูกค้า", "ลูกค้า", "รหัส", "ชื่อตัวแทน", "จังหวัด", "ภาค", "ประเภทอาคาร", "แม่แบบ", "วันที่ส่งมอบ", "ยอดซื้อรวม", "ซื้อล่าสุด"]}
            rows={filtered.map(c => [
              customerCode(c.dealerCode, c.localId ?? c.id),
              c.name, c.dealerCode, c.dealerName, c.province, c.region ?? "—",
              c.buildingTypes.join(", ") || "—",
              c.templates.join(", ") || "—",
              c.deliveredAt ? toThaiDate(c.deliveredAt) : "—",
              c.totalRevenue,
              c.lastPurchase ?? "—",
            ])}
          />
        </div>
      </div>

      <CustomerKPICards rows={filtered} />

      {/* ตัวกรอง — ค้นหา + ตัวแทน/ภาค/จังหวัด/ประเภทอาคาร/ปีที่ส่งมอบ */}
      <div className="card hq-sticky-filter" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "nowrap", padding: "10px 14px" }}>
        {/* ช่องค้นหายืดกินที่ว่างตอนจอกว้าง และยุบก่อนตัวกรองตอนจอแคบ (จึงไม่ต้องมี spacer คั่น) */}
        <div className="search-bar" style={{ flex: "1 1 216px", width: "auto", minWidth: 132 }}>
          <Search size={14} color="#9ca3af" strokeWidth={2} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า หรือจังหวัด..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

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

      </div>

      <CustomerAnalytics rows={filtered} />

      {/* ตารางเต็มอยู่ท้ายหน้าตามเดิม (ตามที่บอสสั่ง — ไม่แยกแท็บ) */}
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
