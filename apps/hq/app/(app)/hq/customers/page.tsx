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
//
// ── M9 Phase 6: filter + pagination + KPI/กราฟ ย้ายไปคำนวณที่ DB (migration 0080) ──
// เดิมดึงลูกค้าทั้งเครือมาไว้ในเครื่องทั้งก้อนแล้วทำทุกอย่างฝั่ง client — ที่สเกลจริง (พันรายขึ้นไป) ไม่ไหว
// supabase: useHQCustomersPage/useHQCustomersFilterOptions (RPC) · local/demo: useCustomerDbLocal (client, ไม่ยิง fetch)
import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { customerCode, fmtISOToThai } from "@pms/shared/lib/mock";
import { useCustomerDbLocal, buildingOf, regionOf, REGIONS, type CustomerDbRow } from "@pms/shared/lib/customerDb";
import { useHQCustomersPage, useHQCustomersFilterOptions, useCustomerBuildings } from "@pms/shared/lib/useNetworkData";
import { metrics as metricsRepo } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import type { HQCustomerPageRow, HQCustomersKPI, HQCustomersCharts } from "@pms/shared/lib/data/ports";
import { CustomerKPICards } from "@pms/shared/components/hq/customers/CustomerKPICards";
import { CustomerAnalytics } from "@pms/shared/components/hq/customers/CustomerAnalytics";
import { CustomerTable } from "@pms/shared/components/hq/customers/CustomerTable";
import { CustomerDrawer } from "@pms/shared/components/hq/customers/CustomerDrawer";

const PAGE_SIZE = 10;

export default function HQCustomersPage() {
  // ตัวกรองเฉพาะหน้านี้ (ไม่จำข้ามหน้า) — ช่วงเวลาใช้ FilterBar ส่วนกลาง
  const [search, setSearch] = useState("");
  const [dealerSel, setDealerSel] = useState("all");
  const [regionSel, setRegionSel] = useState("all");
  const [provinceSel, setProvinceSel] = useState("all");
  const [typeSel, setTypeSel] = useState("all");
  const [yearSel, setYearSel] = useState("all");        // ปีที่ส่งมอบ
  const [page, setPage] = useState(0);
  const [viewId, setViewId] = useState<number | null>(null);

  // เปลี่ยนตัวกรอง (ไม่ใช่หน้า) → กลับไปหน้า 1 เสมอ
  useEffect(() => { setPage(0); }, [search, dealerSel, regionSel, provinceSel, typeSel, yearSel]);

  // ── fallback ฝั่ง local/demo (ยังไม่กลับ) — ไม่ยิง fetch เลยในโหมด HQ+supabase (ดูคอมเมนต์ที่ hook) ──
  const localSource = useCustomerDbLocal();

  // ── ตัวเลือกตัวกรอง — supabase: RPC ครั้งเดียว ไม่อิงตัวกรองปัจจุบัน · local: จาก localSource ทั้งก้อน ──
  const remoteOptions = useHQCustomersFilterOptions();
  const dealerOptions = useMemo<[string, string][]>(() => {
    if (remoteOptions) return remoteOptions.dealers.map(d => [d.code, d.name]);
    const m = new Map<string, string>();
    localSource.forEach(c => m.set(c.dealerCode, c.dealerName));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [remoteOptions, localSource]);

  const allProvinces = useMemo<string[]>(() => {
    if (remoteOptions) return remoteOptions.provinces;
    return [...new Set(localSource.map(c => c.province).filter((p): p is string => !!p))];
  }, [remoteOptions, localSource]);
  const provinceOptions = useMemo(
    () => allProvinces.filter(p => regionSel === "all" || regionOf(p) === regionSel).sort((a, b) => a.localeCompare(b, "th")),
    [allProvinces, regionSel],
  );

  const typeOptions = useMemo<string[]>(() => {
    if (remoteOptions) return remoteOptions.types;
    return [...new Set(localSource.flatMap(c => c.buildingTypes))].sort((a, b) => a.localeCompare(b, "th"));
  }, [remoteOptions, localSource]);

  const yearOptions = useMemo<number[]>(() => {
    if (remoteOptions) return remoteOptions.years;
    const set = new Set<number>();
    localSource.forEach(c => c.buildings.forEach(b => b.deliveredAt && set.add(b.deliveredAt.getFullYear() + 543)));
    return [...set].sort((a, b) => b - a);
  }, [remoteOptions, localSource]);

  // region → provinces[] (resolve ให้ RPC ก่อนส่ง — ตารางไม่มีคอลัมน์ region เก็บตรง ๆ)
  const resolvedProvinces = useMemo<string[] | undefined>(() => {
    if (provinceSel !== "all") return [provinceSel];
    if (regionSel !== "all") return allProvinces.filter(p => regionOf(p) === regionSel);
    return undefined;
  }, [provinceSel, regionSel, allProvinces]);

  const pageOpts = useMemo(() => ({
    search: search.trim() || undefined,
    dealerCode: dealerSel === "all" ? undefined : dealerSel,
    provinces: resolvedProvinces,
    buildingType: typeSel === "all" ? undefined : typeSel,
    deliveryYear: yearSel === "all" ? undefined : Number(yearSel),
    limit: PAGE_SIZE, offset: page * PAGE_SIZE,
  }), [search, dealerSel, resolvedProvinces, typeSel, yearSel, page]);

  const pageResult = useHQCustomersPage(pageOpts);

  // ── fallback ฝั่ง client (local/demo) — ตรรกะกรอง/เรียงเดิมเป๊ะ ──
  const localFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localSource
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
  }, [localSource, search, dealerSel, regionSel, provinceSel, typeSel, yearSel]);

  // kpi/charts/rows — supabase: ตรงจาก RPC · local: derive จาก localFiltered ให้ shape เดียวกัน
  const kpi: HQCustomersKPI = pageResult ? pageResult.kpi : {
    total: localFiltered.length,
    active: localFiltered.filter(r => r.buildings.length > 0).length,
    revenue: localFiltered.reduce((s, r) => s + r.totalRevenue, 0),
    repeat: localFiltered.filter(r => r.isRepeat).length,
  };
  const charts: HQCustomersCharts = pageResult ? pageResult.charts : (() => {
    const countBy = (keysOf: (r: CustomerDbRow) => string[]) => {
      const m = new Map<string, number>();
      localFiltered.forEach(r => keysOf(r).forEach(k => m.set(k, (m.get(k) ?? 0) + 1)));
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const byDealerMap = new Map<string, { name: string; value: number }>();
    const revByDealerMap = new Map<string, number>();
    localFiltered.forEach(c => {
      const bd = byDealerMap.get(c.dealerCode) ?? { name: c.dealerName, value: 0 }; bd.value++; byDealerMap.set(c.dealerCode, bd);
      revByDealerMap.set(c.dealerCode, (revByDealerMap.get(c.dealerCode) ?? 0) + c.totalRevenue);
    });
    return {
      byType: countBy(r => r.buildingTypes),
      bySubtype: countBy(r => r.templates),
      byProvince: countBy(r => r.province ? [r.province] : []).slice(0, 10),
      byDealer: [...byDealerMap.entries()].map(([code, x]) => ({ code, name: x.name, value: x.value })).sort((a, b) => b.value - a.value),
      revenueByDealer: [...revByDealerMap.entries()].map(([code, revenue]) => ({ code, revenue })).sort((a, b) => b.revenue - a.revenue),
    };
  })();
  const tableRows: HQCustomerPageRow[] = pageResult
    ? pageResult.rows
    : localFiltered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(c => ({
        id: c.id, name: c.name, dealerCode: c.dealerCode, dealerName: c.dealerName, province: c.province,
        totalValue: c.totalRevenue, buildingTypes: c.buildingTypes, templates: c.templates,
        deliveredAt: c.deliveredAt ? c.deliveredAt.toISOString().slice(0, 10) : null,
        lastPurchaseAt: c.lastPurchaseAt ? c.lastPurchaseAt.toISOString().slice(0, 10) : null,
      }));
  const totalCount = pageResult ? pageResult.total : localFiltered.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pagination = totalCount > 0 ? { page, pageCount, total: totalCount, onPage: setPage } : undefined;
  // supabase: RPC หน้าแรกยังไม่กลับ (pageResult ยัง null) — ต้องแยกจาก "กรองแล้วไม่เจอจริง ๆ" (Critical เดิม 30 ก.ค. 69)
  const isLoading = DATA_SOURCE === "supabase" && pageResult === null;

  // ── แผงรายละเอียด — local: ได้ CustomerDbRow เต็มจาก localFiltered ตรง ๆ (มี buildings อยู่แล้ว)
  //    supabase: ต้องเฟตช์ใบ won ของลูกค้ารายนั้นแยก (ไม่ได้มากับแถวสรุปที่แบ่งหน้า) ──
  const localDetail = useMemo(() => viewId != null ? localSource.find(c => c.id === viewId) ?? null : null, [viewId, localSource]);
  const remoteRowMeta = pageResult?.rows.find(r => r.id === viewId) ?? null;
  const needsRemoteDetail = !!pageResult && viewId != null && !localDetail;
  // ต้องส่งรหัสสาขาไปด้วย — เลขที่ลูกค้าซ้ำกันได้ข้ามสาขา ถ้าไม่ระบุ HQ จะดึงใบของ
  // ลูกค้าเลขเดียวกันจากสาขาอื่นมาปนในแผงนี้ (ผลตรวจรอบ 2 · ระดับสูง)
  const remoteBuildQuotes = useCustomerBuildings(needsRemoteDetail ? viewId : null, remoteRowMeta?.dealerCode ?? null);
  const viewDetail: CustomerDbRow | null = useMemo(() => {
    if (viewId == null) return null;
    if (localDetail) return localDetail;
    if (!remoteRowMeta) return null; // แถวที่คลิกมาจาก pageResult.rows อยู่แล้วเสมอ ไม่ควรเกิด แต่กันไว้
    // buildings ยังไม่มา (กำลังโหลดใบ won แยก) → เปิดแผงไปก่อนด้วย [] ชั่วคราว (โปรไฟล์/ยอดรวมมีอยู่แล้วจาก
    // แถวตารางที่เพิ่งคลิก ไม่ต้องรอ) ไม่งั้นแผงค้างไม่เปิดจนกว่า fetch ที่สองจะเสร็จ — ผู้ใช้กดแล้วไม่มีอะไรเกิดขึ้น
    const buildings = (remoteBuildQuotes ?? [])
      .map(q => buildingOf({ quoteNo: q.id, productLine: q.buildingType || q.project || "", valueNum: q.totalValue, createdAt: fmtISOToThai(q.date) }))
      .sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0));
    const latest = [...buildings]
      .filter((b): b is typeof b & { deliveredAt: Date } => !!b.deliveredAt)
      .sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime())
      .pop() ?? null;
    const lastBuy = [...buildings].filter(b => b.wonAt).pop() ?? null;
    return {
      id: remoteRowMeta.id, localId: remoteRowMeta.id, name: remoteRowMeta.name,
      dealerCode: remoteRowMeta.dealerCode, dealerName: remoteRowMeta.dealerName, province: remoteRowMeta.province,
      dealsWon: 0, totalRevenue: remoteRowMeta.totalValue, status: "active", lastContact: "—", segment: "sme",
      region: regionOf(remoteRowMeta.province), buildings,
      buildingTypes: [...new Set(buildings.map(b => b.buildingType).filter(Boolean))],
      templates: [...new Set(buildings.map(b => b.template).filter((t): t is string => !!t))],
      deliveredAt: latest?.deliveredAt ?? null,
      lastPurchase: lastBuy?.wonDate ?? null, lastPurchaseAt: lastBuy?.wonAt ?? null,
      isRepeat: buildings.length > 1,
    };
  }, [viewId, localDetail, remoteRowMeta, remoteBuildQuotes]);

  // ตัวกรอง 5 ช่อง + ช่องค้นหา ต้องอยู่บรรทัดเดียว (แถวนี้ตั้ง flex-wrap: nowrap)
  //   maxWidth — select ที่ width:auto จะกว้างตามตัวเลือกที่ยาวที่สุด (เช่น "RYG – ตัวแทนระยอง สตีล") ต้องคุมเพดาน
  //   minWidth: 0 + flexShrink — ให้ยุบตัวลงได้เมื่อจอแคบ แทนที่จะตกบรรทัด (nowrap ทำให้ยุบก่อน ไม่ใช่ wrap)
  // ขนาดตัวอักษร/ระยะขอบ ใช้สเกลเดียวกับแถบกรองหน้า /hq/pipeline
  const selectStyle = { width: "auto", flex: "0 1 auto", minWidth: 0, maxWidth: 146, padding: "7px 10px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer" } as const;

  // Export — หนึ่งแถวต่อลูกค้า · supabase: ดึงทั้งชุดที่กรองจาก DB ตอนกด (limit=total) · local: จาก localFiltered ทั้งชุดอยู่แล้ว
  const rowToCells = (c: HQCustomerPageRow) => [
    customerCode(c.dealerCode, c.id), c.name, c.dealerCode, c.dealerName, c.province, regionOf(c.province) ?? "—",
    c.buildingTypes.join(", ") || "—", c.templates.join(", ") || "—",
    c.deliveredAt ? fmtISOToThai(c.deliveredAt) : "—", c.totalValue, c.lastPurchaseAt ? fmtISOToThai(c.lastPurchaseAt) : "—",
  ];
  const localExportRows = localFiltered.map(c => [
    customerCode(c.dealerCode, c.localId ?? c.id), c.name, c.dealerCode, c.dealerName, c.province, c.region ?? "—",
    c.buildingTypes.join(", ") || "—", c.templates.join(", ") || "—",
    c.deliveredAt ? fmtISOToThai(c.deliveredAt.toISOString().slice(0, 10)) : "—", c.totalRevenue, c.lastPurchase ?? "—",
  ]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p>ฐานข้อมูลลูกค้าทุกตัวแทน · ทั้งหมด {totalCount.toLocaleString()} ราย</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ExportMenu
            filename="hq-customers"
            title="ลูกค้าทั้งเครือ"
            headers={["รหัสลูกค้า", "ลูกค้า", "รหัส", "ชื่อตัวแทน", "จังหวัด", "ภาค", "ประเภทอาคาร", "แม่แบบ", "วันที่ส่งมอบ", "ยอดซื้อรวม", "ซื้อล่าสุด"]}
            rows={pageResult ? tableRows.map(rowToCells) : localExportRows}
            getRows={pageResult
              ? async () => {
                  const all = await metricsRepo.hqCustomersPage({ ...pageOpts, limit: Math.max(1, totalCount), offset: 0 });
                  return all.rows.map(rowToCells);
                }
              : undefined}
          />
        </div>
      </div>

      <CustomerKPICards kpi={kpi} />

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

        <select aria-label="กรองตามตัวแทน" value={dealerSel} onChange={e => setDealerSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกตัวแทน</option>
          {dealerOptions.map(([code, name]) => <option key={code} value={code}>{code} – {name}</option>)}
        </select>

        <select
          aria-label="กรองตามภูมิภาค"
          value={regionSel}
          onChange={e => { setRegionSel(e.target.value); setProvinceSel("all"); }}
          className="form-select" style={selectStyle}
        >
          <option value="all">ทุกภาค</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select aria-label="กรองตามจังหวัด" value={provinceSel} onChange={e => setProvinceSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกจังหวัด</option>
          {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select aria-label="กรองตามประเภทอาคาร" value={typeSel} onChange={e => setTypeSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกประเภทอาคาร</option>
          {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select aria-label="กรองตามปี" value={yearSel} onChange={e => setYearSel(e.target.value)} className="form-select" style={selectStyle}>
          <option value="all">ทุกปีที่ส่งมอบ</option>
          {yearOptions.map(y => <option key={y} value={y}>ส่งมอบปี {y}</option>)}
        </select>

      </div>

      <CustomerAnalytics charts={charts} />

      {/* ตารางเต็มอยู่ท้ายหน้าตามเดิม (ตามที่บอสสั่ง — ไม่แยกแท็บ) */}
      <div className="card">
        <CustomerTable rows={tableRows} onView={r => setViewId(r.id)} pagination={pagination} loading={isLoading} />
      </div>

      <CustomerDrawer row={viewDetail} onClose={() => setViewId(null)} />
    </div>
  );
}
