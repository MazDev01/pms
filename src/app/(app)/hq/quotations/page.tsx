"use client";

// ─── HQ · ใบเสนอราคาทั้งเครือ (Network Quotations) ────────────────────────────
// ศูนย์กลางใบเสนอราคาของตัวแทนทุกสาขา — HQ เป็นเจ้าของข้อมูล แต่ "ไม่ออกใบเอง"
// จึงมีแค่ ดู / วิเคราะห์ / เปรียบเทียบ / ส่งออก — ไม่มีปุ่มสร้าง แก้ไข ลบ อนุมัติ
import { useState, useMemo, useEffect } from "react";
import { hqAllQuotations, loadHQPolicy, loadQuoteValidityDays, quotationStatusLabel, mainTemplateOf } from "@/lib/mock";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useFilters } from "@/context/FilterContext";
import { useNetworkQuotations } from "@/lib/useNetworkData";
import {
  toQuoteRows, aggregate, regionDisplay, ALL_REGIONS, STATUS_ORDER, type QuoteRow,
} from "@/lib/hqQuotations";
import { QuotationKPICards } from "@/components/hq/quotations/QuotationKPICards";
import { QuotationFilterBar, EMPTY_FILTERS, type QuotationFilters } from "@/components/hq/quotations/QuotationFilterBar";
import { QuotationAnalytics } from "@/components/hq/quotations/QuotationAnalytics";
import { QuotationTable } from "@/components/hq/quotations/QuotationTable";
import { QuotationDrawer } from "@/components/hq/quotations/QuotationDrawer";

const ALL_DEALERS = [...new Map(hqAllQuotations.map(q => [q.dealerCode, q.dealerName])).entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code));

export default function NetworkQuotationPage() {
  const { inRange, timeRange } = useFilters();
  const netQuotes = useNetworkQuotations();
  const [filters, setFilters] = useState<QuotationFilters>(EMPTY_FILTERS);
  const [viewQ, setViewQ] = useState<QuoteRow | null>(null);

  // นโยบาย HQ อยู่ใน localStorage → อ่านหลัง mount (กัน hydration mismatch)
  const [validityDays, setValidityDays] = useState(30);
  const [maxDiscount, setMaxDiscount] = useState(10);
  useEffect(() => {
    setValidityDays(loadQuoteValidityDays());
    setMaxDiscount(loadHQPolicy().maxDiscount);
  }, []);

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

  const tableRows = useMemo(() => [...rows].sort((a, b) => {
    const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (so !== 0) return so;
    return (b.createdDate?.getTime() ?? 0) - (a.createdDate?.getTime() ?? 0);
  }), [rows]);

  const agg = useMemo(() => aggregate(rows), [rows]);
  const expired = useMemo(() => rows.filter(r => r.status === "expired").length, [rows]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}>ใบเสนอราคาของตัวแทนทุกสาขา · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ExportMenu
            filename="hq-network-quotations"
            title="ใบเสนอราคาทั้งเครือ"
            headers={["เลขที่", "รหัสตัวแทน", "ตัวแทน", "ลูกค้า", "ประเภทอาคาร", "ภูมิภาค", "มูลค่า (บาท)", "ส่วนลด %", "สถานะ", "เปิดอ่าน", "วันที่สร้าง", "ใช้ได้ถึง", "อายุใบ (วัน)"]}
            rows={tableRows.map(q => [
              q.quoteNo, q.dealerCode, q.dealerName, q.customer, q.productLine, regionDisplay(q.region),
              q.valueNum, q.discountPct, quotationStatusLabel[q.status],
              !q.sent ? "ยังไม่ได้ส่ง" : q.opened ? "ใช่" : "ไม่",
              q.createdAt, q.validUntil ?? "—", q.agingDays ?? "—",
            ])}
          />
        </div>
      </div>

      <QuotationKPICards agg={agg} expired={expired} />

      <QuotationFilterBar
        filters={filters}
        onChange={setFilters}
        dealers={ALL_DEALERS}
        regions={ALL_REGIONS}
        products={products}
        resultCount={rows.length}
      />

      <QuotationAnalytics rows={rows} trendRows={trendRows} />

      <QuotationTable rows={tableRows} onView={setViewQ} maxDiscount={maxDiscount} />

      {viewQ && <QuotationDrawer quote={viewQ} maxDiscount={maxDiscount} onClose={() => setViewQ(null)} />}
    </div>
  );
}
