"use client";

// ─── แหล่งข้อมูลเครือแบบรวม (Single source สำหรับหน้า HQ) ──────────────────────
// รวม "ใบเสนอราคา/ลูกค้าที่ดีลเลอร์สร้างจริง" (SalesContext = สมุดงานสาขา CNX)
// เข้ากับ seed ของสาขาอื่น (hqAllQuotations/hqAllCustomers)
// → ดีลเลอร์สร้าง/แก้ใบเสนอราคา แล้ว HQ เห็นทันที (dedup ด้วยเลขที่/ชื่อ · live ทับ seed)
import { useMemo, useEffect, useState } from "react";
import { useSales } from "@pms/shared/context/SalesContext";
import {
  dealerDetails, dealerLeaderboard, fmtISOToThai, hqAllQuotations, hqAllCustomers,
  type HQQuotation, type HQCustomer, type LeadStatus, type LeadRow,
  type DealerDetail, type DealerLeadItem, type DealerProjectItem, type DealerQuoteItem,
} from "@pms/shared/lib/mock";
import { parseBaht } from "@pms/shared/lib/format";
import { useRepoValue } from "@pms/shared/lib/useRepoState";
import { dealers as dealersRepo, metrics as metricsRepo } from "@pms/shared/lib/data";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import type { DealerRow } from "@pms/shared/lib/data/types";
import type { QuoteRangeRow, DashboardQuoteSummary, HQQuotationsSummary, QuoteSummaryFilters, QuoteListOpts, QuoteListResult, LeadSummary, LeadSummaryFilters } from "@pms/shared/lib/data/ports";
import { metrics as metricsRepo2, quotations as quotationsRepo } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";

// ── aggregate ใบในช่วงวันที่ที่ DB (M9) — supabase เท่านั้น · local คืน null (คงเส้นทาง winQuotes เดิม) ──
// reactive: refetch เมื่อ quotations เปลี่ยน หรือช่วง/สาขาเปลี่ยน · debounce 150ms
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function useNetworkQuoteRange(start: Date, end: Date, dealer?: string): Map<string, QuoteRangeRow> | null {
  const { salesVersion } = useSales();
  const s = isoDate(start), e = isoDate(end);
  const [rows, setRows] = useState<Map<string, QuoteRangeRow> | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setRows(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo.networkQuoteRange(s, e, dealer)
        .then(r => { if (alive) setRows(r); })
        .catch(err => logRepoRead("metrics.networkQuoteRange", err));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [s, e, dealer, salesVersion]);
  return rows;
}

// สรุปลีด "หลังกรอง" ที่ DB สำหรับ /hq/leads — M9 Phase 2 · supabase เท่านั้น · local คืน null → client fallback
// reactive: refetch เมื่อ leads เปลี่ยน หรือ filters เปลี่ยน
export function useLeadSummary(filters: LeadSummaryFilters): LeadSummary | null {
  const { salesVersion } = useSales();
  const key = JSON.stringify(filters);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setSummary(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo2.leadSummary(filters)
        .then(r => { if (alive) setSummary(r); })
        .catch(err => logRepoRead("metrics.leadSummary", err));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, salesVersion]);
  return summary;
}

// สรุปใบ "หลังกรอง" ที่ DB สำหรับ /hq/quotations (byDealer/byMonth/byProduct/aging) — M9 Phase 2
// supabase เท่านั้น · local คืน null → หน้าใช้ client fallback (คำนวณจาก rows เดิม)
export function useHQQuotationsSummary(filters: QuoteSummaryFilters): HQQuotationsSummary | null {
  const { salesVersion } = useSales();
  const key = JSON.stringify(filters);
  const [summary, setSummary] = useState<HQQuotationsSummary | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setSummary(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo2.hqQuotationsSummary(filters)
        .then(r => { if (alive) setSummary(r); })
        .catch(err => logRepoRead("metrics.hqQuotationsSummary", err));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, salesVersion]);
  return summary;
}

// หน้าเดียวของตารางใบ (paged/filtered/sorted ที่ DB) — M9 Phase 2 · supabase เท่านั้น · local คืน null
export function useQuotationsPage(opts: QuoteListOpts): QuoteListResult | null {
  const { salesVersion } = useSales();
  const key = JSON.stringify(opts);
  const [page, setPage] = useState<QuoteListResult | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setPage(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      quotationsRepo.listPage(undefined, opts)
        .then(r => { if (alive) setPage(r); })
        .catch(err => logRepoRead("quotations.listPage", err));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, salesVersion]);
  return page;
}

// สรุปใบในช่วง (byMonth/byStatus/byProduct) ที่ DB รอบเดียว — ป้อนหลายการ์ด (M9)
// supabase เท่านั้น · local คืน null → dashboard คงคำนวณจาก winQuotes เดิม
export function useDashboardQuoteSummary(start: Date, end: Date, dealer?: string): DashboardQuoteSummary | null {
  const { salesVersion } = useSales();
  const s = isoDate(start), e = isoDate(end);
  const [summary, setSummary] = useState<DashboardQuoteSummary | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setSummary(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo.dashboardQuoteSummary(s, e, dealer)
        .then(r => { if (alive) setSummary(r); })
        .catch(err => logRepoRead("metrics.dashboardQuoteSummary", err));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [s, e, dealer, salesVersion]);
  return summary;
}

// โหมด supabase = ข้อมูลจริงทุกสาขาอยู่ใน DB แล้ว (SalesContext ฝั่ง HQ โหลดมาทั้งเครือ)
// → ห้ามเอา seed จำลอง (hqAllQuotations/hqAllCustomers/dealerDetails) มาผสมเด็ดขาด
//   ไม่งั้น HQ จะเห็น "ข้อมูลที่ไม่มีอยู่จริง" ปนกับของจริง (กติกา: ห้ามกุข้อมูล)
// โหมด local = ยังเป็นเดโม → คงพฤติกรรมเดิมไว้ให้หน้าจอมีข้อมูลให้ดู
const USE_SEED = DATA_SOURCE !== "supabase";

// ดีลเลอร์หลักของเดโม (สาขาที่ลีด/ใบไม่ระบุ dealerCode ถือเป็นของสาขานี้)
export const CURRENT_DEALER = { code: "CNX", name: "เชียงใหม่สตีลบิลด์" };

// multi-tenant: บันทึกที่สาขาอื่นสร้างจริง (SalesContext ติด dealerCode) → HQ ต้องระบุสาขาให้ถูก
//
// ชื่อสาขาต้องมาจากทะเบียนจริง — เดิมสร้าง Map จากชุด seed ตอน import โมดูล
// สาขาที่ HQ เพิ่มใหม่จึงแสดงเป็นรหัส 3 ตัวแทนชื่อบริษัท และแก้ชื่อแล้วก็ไม่เปลี่ยนตาม
// อ่านไม่ได้/ยังไม่โหลด → ใช้รหัสสาขาไปก่อน (ไม่กุชื่อขึ้นมาเอง)
function useDealerInfo() {
  const dealers = useRepoValue<DealerRow[]>(() => dealersRepo.list(), []);
  return useMemo(() => {
    const byCode = new Map(dealers.map(d => [d.code, d.name]));
    return (code: string | undefined) => {
      const c = code ?? CURRENT_DEALER.code;
      return { code: c, name: byCode.get(c) ?? c };
    };
  }, [dealers]);
}

// ใบเสนอราคาทั้งเครือ = ใบที่ดีลเลอร์สร้างจริง (map เป็นสาขา CNX) + seed สาขาอื่นที่ไม่ซ้ำเลขที่
export function useNetworkQuotations(): HQQuotation[] {
  const { quotations, leads } = useSales();
  const dealerInfoOf = useDealerInfo();
  return useMemo(() => {
    const live: HQQuotation[] = quotations.map(q => {
      const lead = leads.find(l => (q.dealId != null && l.numId === q.dealId) || (q.customerId > 0 && l.customerId === q.customerId));
      const dl = dealerInfoOf(q.dealerCode); // สาขาเจ้าของใบจริง (undefined = CNX)
      return {
        id: `LIVE-${q.id}`, quoteNo: q.id,
        dealerCode: dl.code, dealerName: dl.name,
        customer: q.customer, valueNum: q.totalValue,
        status: q.status, createdAt: fmtISOToThai(q.date),
        salesperson: lead?.assigned ?? `ตัวแทน ${dl.code}`,
        productLine: q.buildingType || q.project,
        // รายละเอียดราคาจริงของใบที่ดีลเลอร์สร้าง → HQ เจาะดูรายการสินค้าได้
        materialCost: q.materialCost, lineItems: q.lineItems,
      };
    });
    if (!USE_SEED) return live; // supabase: ใบทุกสาขามาจาก DB จริงแล้ว
    const liveNos = new Set(live.map(l => l.quoteNo));
    return [...live, ...hqAllQuotations.filter(h => !liveNos.has(h.quoteNo))];
  }, [quotations, leads]);
}

// ลีดทั้งเครือ = ลีดจริงจาก SalesContext เท่านั้น (ไม่มีข้อมูลเติมสังเคราะห์)
// ลีดที่ระบุ dealerCode = ของสาขานั้น · ลีดที่ไม่ระบุ = สมุดงานของสาขา CNX (ดีลเลอร์ที่เล่นได้)
export function useNetworkLeads(): LeadRow[] {
  const { leads } = useSales();
  return useMemo(() => leads.map(l => ({ ...l, dealerCode: l.dealerCode ?? CURRENT_DEALER.code })), [leads]);
}

// ลูกค้าทั้งเครือ = ลูกค้าที่ดีลเลอร์สร้างจริง (สาขา CNX) + seed สาขาอื่นที่ไม่ซ้ำชื่อ
export function useNetworkCustomers(): HQCustomer[] {
  const { customers, quotations } = useSales();
  const dealerInfoOf = useDealerInfo();
  return useMemo(() => {
    const live: HQCustomer[] = customers.map(c => {
      const dl = dealerInfoOf(c.dealerCode); // สาขาเจ้าของลูกค้าจริง (undefined = CNX)
      return {
        // id = คีย์ฝั่ง HQ (กันชนกับ seed) · localId = เลขนับจริงของสาขา → ใช้ออกรหัสลูกค้า
        id: 10000 + c.id, localId: c.id, name: c.company,
        dealerCode: dl.code, dealerName: dl.name,
        province: c.province,
        dealsWon: quotations.filter(q => q.customerId === c.id && q.status === "won").length,
        totalRevenue: c.totalValue,
        status: c.status === "inactive" ? "inactive" : "active",
        // ระบบยังไม่บันทึก "วันติดต่อล่าสุด" ของลูกค้า (มีแต่ของลีด) → ไม่มีข้อมูลก็ต้องขึ้น "—"
        // เดิมยัดวันเดียวกันให้ลูกค้าทุกรายทั้งเครือ = ค่าที่กุขึ้นมา
        lastContact: "—", segment: "sme",
      };
    });
    if (!USE_SEED) return live; // supabase: ลูกค้าทุกสาขามาจาก DB จริงแล้ว
    // กันซ้ำด้วย dealerCode ไม่ใช่ชื่อ — ชื่อสะกดต่างนิดเดียวก็หลุด
    // (เคยมี "บ.ไทยสตีล" ใน seed กับ "บจ. ไทยสตีล" ในสมุดสด แล้ว HQ นับเป็น 2 ราย)
    // ลูกค้าของสาขาที่เล่นได้มาจากสมุดสดเสมอ → seed ของสาขานั้นไม่ต้องเอามาต่อท้าย
    return [...live, ...hqAllCustomers.filter(h => h.dealerCode !== CURRENT_DEALER.code)];
  }, [customers, quotations]);
}

// ─── รายละเอียดตัวแทน (เจาะรายสาขา) — CNX = ข้อมูลสด · สาขาอื่น = seed ────────────
const LEAD_TO_ITEM: Record<LeadStatus, DealerLeadItem["status"]> = {
  WAITING: "contacted", BULLET: "contacted", QUOTED: "quoted", FOLLOWUP: "quoted", NEGO: "quoted", PAID: "won", CANCELLED: "lost",
};
const LEAD_PROGRESS: Record<LeadStatus, number> = { WAITING: 15, BULLET: 30, QUOTED: 50, FOLLOWUP: 65, NEGO: 80, PAID: 100, CANCELLED: 0 };
const TH_MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function useNetworkDealerDetail(code: string): DealerDetail {
  const { leads, quotations } = useSales();
  return useMemo(() => {
    // โหมด local (เดโม): มีข้อมูลสดเฉพาะสาขาที่เล่นได้ (CNX) — สาขาอื่นใช้ seed จำลอง
    // โหมด supabase: ทุกสาขามีข้อมูลจริงใน DB → สร้างจากข้อมูลจริงเสมอ (ห้ามใช้ seed)
    if (USE_SEED && code !== CURRENT_DEALER.code) {
      return dealerDetails[code] ?? { code, monthlySales: [], leads: [], projects: [], quotes: [] };
    }
    // กรองเหลือเฉพาะของสาขานี้ — SalesContext ฝั่ง HQ ถือข้อมูลทั้งเครือ
    // (ลีด/ใบที่ไม่ระบุ dealerCode = ของสาขา CNX ตามกติกาเดิม)
    const mine = leads.filter(l => (l.dealerCode ?? CURRENT_DEALER.code) === code);
    const myQuotes = quotations.filter(q => (q.dealerCode ?? CURRENT_DEALER.code) === code);
    const quotes: DealerQuoteItem[] = myQuotes.map(q => ({
      quoteNo: q.id, customer: q.customer, product: q.buildingType || q.project,
      valueNum: q.totalValue, status: q.status, date: fmtISOToThai(q.date),
    }));
    const leadItems: DealerLeadItem[] = mine.map(l => ({
      id: l.id, name: l.company || l.name, province: l.province, product: l.product,
      valueNum: parseBaht(l.value), status: LEAD_TO_ITEM[l.status], assignedAt: l.createdAt ?? "—",
    }));
    const projects: DealerProjectItem[] = mine.filter(l => l.status !== "CANCELLED").map(l => ({
      id: l.id, name: l.company || l.name, product: l.product, valueNum: parseBaht(l.value),
      progress: LEAD_PROGRESS[l.status], status: l.status === "PAID" ? "completed" : "in_progress",
    }));
    // ยอดขายรายเดือน (พันบาท) จากใบเสนอราคาที่ปิดได้ของสาขานี้ · แสดง ม.ค.–มิ.ย. (mock วันนี้ = มิ.ย.)
    const byMonth = new Map<number, number>();
    myQuotes.forEach(q => {
      if (q.status !== "won") return;
      const m = parseInt((q.date || "").slice(5, 7)) - 1;
      if (!isNaN(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + q.totalValue);
    });
    const monthlySales = TH_MO.slice(0, 6).map((month, i) => ({ month, value: Math.round((byMonth.get(i) ?? 0) / 1000) }));
    return { code, monthlySales, leads: leadItems, projects, quotes };
  }, [code, leads, quotations]);
}
