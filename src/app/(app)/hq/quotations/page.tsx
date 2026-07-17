"use client";

// ─── HQ · ใบเสนอราคาทั้งเครือ (Network Quotations) ────────────────────────────
// ศูนย์กลางใบเสนอราคาของตัวแทนทุกสาขา — HQ เป็นเจ้าของข้อมูล แต่ "ไม่ออกใบเอง"
// จึงมีแค่ ดู / วิเคราะห์ / เปรียบเทียบ / ส่งออก — ไม่มีปุ่มสร้าง แก้ไข ลบ อนุมัติ
import { useState, useMemo, useEffect } from "react";
import { hqAllQuotations, loadQuoteValidityDays, quotationStatusLabel, mainTemplateOf } from "@/lib/mock";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFilters } from "@/context/FilterContext";
import { useNetworkQuotations, useNetworkLeads } from "@/lib/useNetworkData";
import {
  toQuoteRows, aggregate, regionDisplay, regionOfDealer, provinceOfDealer,
  ALL_REGIONS, ALL_PROVINCES, STATUS_ORDER, type QuoteRow,
} from "@/lib/hqQuotations";
import { QuotationKPICards } from "@/components/hq/quotations/QuotationKPICards";
import { QuotationFilterBar, EMPTY_FILTERS, type QuotationFilters } from "@/components/hq/quotations/QuotationFilterBar";
import { FilterBar } from "@/components/filters/FilterBar";
import { QuotationAnalytics } from "@/components/hq/quotations/QuotationAnalytics";
import { QuotationTable } from "@/components/hq/quotations/QuotationTable";
import { QuotationDrawer } from "@/components/hq/quotations/QuotationDrawer";

const ALL_DEALERS = [...new Map(hqAllQuotations.map(q => [q.dealerCode, q.dealerName])).entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code));

export default function NetworkQuotationPage() {
  const { inRange, timeRange } = useFilters();
  const netQuotes = useNetworkQuotations();
  const netLeads = useNetworkLeads();
  const [filters, setFilters] = useState<QuotationFilters>(EMPTY_FILTERS);
  const [viewQ, setViewQ] = useState<QuoteRow | null>(null);

  // นโยบาย HQ อยู่ใน localStorage → อ่านหลัง mount (กัน hydration mismatch)
  const [validityDays, setValidityDays] = useState(30);
  useEffect(() => { setValidityDays(loadQuoteValidityDays()); }, []);

  // เปิดหน้าด้วย ?dealer=CODE (กดมาจากแดชบอร์ด/การ์ดสถิติ) → กรองตัวแทนนั้นให้เลย
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("dealer");
    if (code && ALL_DEALERS.some(d => d.code === code)) setFilters(f => ({ ...f, dealer: code }));
    if (code) window.history.replaceState(null, "", "/hq/quotations");
  }, []);

  const allRows = useMemo(() => toQuoteRows(netQuotes, validityDays), [netQuotes, validityDays]);

  const products = useMemo(
    () => [...new Set(allRows.map(r => mainTemplateOf(r.productLine)))].sort(),
    [allRows],
  );

  // ตัวกรองทุกตัว "ยกเว้นช่วงเวลา" — กราฟแนวโน้ม 12 เดือนใช้ชุดนี้ (ถ้าอิงช่วงเวลาจะว่าง 11 ช่อง)
  const matchesNonTime = useMemo(() => (r: QuoteRow) => {
    if (filters.dealer !== "all" && r.dealerCode !== filters.dealer) return false;
    if (filters.region !== "all" && r.region !== filters.region) return false;
    if (filters.province !== "all" && r.dealerProvince !== filters.province) return false;
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (filters.product !== "all" && r.productLine !== filters.product && mainTemplateOf(r.productLine) !== filters.product) return false;
    if (filters.search.trim()) {
      const s = filters.search.trim().toLowerCase();
      const hay = `${r.quoteNo} ${r.customer} ${r.dealerName} ${r.dealerCode}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }, [filters]);

  const trendRows = useMemo(() => allRows.filter(matchesNonTime), [allRows, matchesNonTime]);
  const rows = useMemo(() => trendRows.filter(r => inRange(r.createdAt)), [trendRows, inRange]);

  // ลีดสำหรับกราฟ "ลีด → ใบเสนอราคา" และ "เหตุผลที่เสียโอกาส"
  // กรองเฉพาะมิติที่ลีดมีจริง: ขอบเขตตัวแทน (ตัวแทน/ภูมิภาค/จังหวัดตัวแทน) + ช่วงเวลา
  // ไม่กรองด้วยสถานะของใบเสนอราคา — เป็นคนละเอกสารกัน จะกรองข้ามไม่ได้
  const leadRows = useMemo(() => netLeads.filter(l => {
    const code = l.dealerCode || "";
    if (filters.dealer !== "all" && code !== filters.dealer) return false;
    if (filters.region !== "all" && regionOfDealer(code) !== filters.region) return false;
    if (filters.province !== "all" && provinceOfDealer(code) !== filters.province) return false;
    return l.createdAt ? inRange(l.createdAt) : true;
  }), [netLeads, filters.dealer, filters.region, filters.province, inRange]);

  const tableRows = useMemo(() => [...rows].sort((a, b) => {
    const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (so !== 0) return so;
    return (b.createdDate?.getTime() ?? 0) - (a.createdDate?.getTime() ?? 0);
  }), [rows]);

  const agg = useMemo(() => aggregate(rows), [rows]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}>ใบเสนอราคาของตัวแทนทุกสาขา · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* ช่วงเวลาอยู่ที่หัวหน้า — ที่เดียวกับทุกหน้า HQ (แดชบอร์ด/ภาพรวมยอดขาย/ลูกค้าเป้าหมาย) */}
          <FilterBar dims={[]} />
          <ExportMenu
            filename="hq-network-quotations"
            title="ใบเสนอราคาทั้งเครือ"
            headers={["เลขที่", "รหัสตัวแทน", "ตัวแทน", "ลูกค้า", "จังหวัด (ตัวแทน)", "ประเภทอาคาร", "ภูมิภาค", "มูลค่า (บาท)", "สถานะ", "วันที่สร้าง", "ใช้ได้ถึง", "อายุใบ (วัน)"]}
            rows={tableRows.map(q => [
              q.quoteNo, q.dealerCode, q.dealerName, q.customer, q.dealerProvince, q.productLine, regionDisplay(q.region),
              q.valueNum, quotationStatusLabel[q.status],
              q.createdAt, q.validUntil ?? "—", q.agingDays ?? "—",
            ])}
          />
        </div>
      </div>

      <QuotationKPICards agg={agg} />

      <QuotationFilterBar
        filters={filters}
        onChange={setFilters}
        dealers={ALL_DEALERS}
        regions={ALL_REGIONS}
        provinces={ALL_PROVINCES}
        products={products}
        resultCount={rows.length}
      />

      <QuotationAnalytics rows={rows} trendRows={trendRows} leads={leadRows} />

      {/* ตารางเต็มอยู่ท้ายหน้าตามเดิม (ตามที่บอสสั่ง — ไม่แยกแท็บ)
          ความยาวหน้าคุมด้วยกฎอื่นแทน: การ์ดกราฟตรึงความสูง S/M/L + กราฟรายการโชว์ Top N */}
      <QuotationTable rows={tableRows} onView={setViewQ} />

      {viewQ && <QuotationDrawer quote={viewQ} onClose={() => setViewQ(null)} />}
    </div>
  );
}
