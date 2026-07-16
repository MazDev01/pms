"use client";

// ─── แหล่งข้อมูลเครือแบบรวม (Single source สำหรับหน้า HQ) ──────────────────────
// รวม "ใบเสนอราคา/ลูกค้าที่ดีลเลอร์สร้างจริง" (SalesContext = สมุดงานสาขา CNX)
// เข้ากับ seed ของสาขาอื่น (hqAllQuotations/hqAllCustomers)
// → ดีลเลอร์สร้าง/แก้ใบเสนอราคา แล้ว HQ เห็นทันที (dedup ด้วยเลขที่/ชื่อ · live ทับ seed)
import { useMemo } from "react";
import { useSales } from "@/context/SalesContext";
import {
  dealerDetails, fmtISOToThai, hqAllQuotations, hqAllCustomers,
  type HQQuotation, type HQCustomer, type LeadStatus, type LeadRow,
  type DealerDetail, type DealerLeadItem, type DealerProjectItem, type DealerQuoteItem,
} from "@/lib/mock";
import { parseBaht } from "@/lib/format";

// ดีลเลอร์หลักของเดโม — SalesContext แทนสมุดงานของสาขานี้
export const CURRENT_DEALER = { code: "CNX", name: "เชียงใหม่สตีลบิลด์" };

// ใบเสนอราคาทั้งเครือ = ใบที่ดีลเลอร์สร้างจริง (map เป็นสาขา CNX) + seed สาขาอื่นที่ไม่ซ้ำเลขที่
export function useNetworkQuotations(): HQQuotation[] {
  const { quotations, leads } = useSales();
  return useMemo(() => {
    const live: HQQuotation[] = quotations.map(q => {
      const lead = leads.find(l => (q.dealId != null && l.numId === q.dealId) || (q.customerId > 0 && l.customerId === q.customerId));
      return {
        id: `LIVE-${q.id}`, quoteNo: q.id,
        dealerCode: CURRENT_DEALER.code, dealerName: CURRENT_DEALER.name,
        customer: q.customer, valueNum: q.totalValue,
        status: q.status, createdAt: fmtISOToThai(q.date),
        salesperson: lead?.assigned ?? `ตัวแทน ${CURRENT_DEALER.code}`,
        productLine: q.buildingType || q.project,
        // รายละเอียดราคาจริงของใบที่ดีลเลอร์สร้าง → HQ เจาะดูรายการสินค้าได้
        materialCost: q.materialCost, lineItems: q.lineItems,
      };
    });
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
  return useMemo(() => {
    const live: HQCustomer[] = customers.map(c => ({
      // id = คีย์ฝั่ง HQ (กันชนกับ seed) · localId = เลขนับจริงของสาขา → ใช้ออกรหัสลูกค้า
      id: 10000 + c.id, localId: c.id, name: c.company,
      dealerCode: CURRENT_DEALER.code, dealerName: CURRENT_DEALER.name,
      province: c.province,
      dealsWon: quotations.filter(q => q.customerId === c.id && q.status === "won").length,
      totalRevenue: c.totalValue,
      status: c.status === "inactive" ? "inactive" : "active",
      lastContact: "30 มิ.ย. 2569", segment: "sme",
    }));
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
    // สาขาอื่น (ไม่ใช่ดีลเลอร์ที่เล่นได้) → seed เดิม
    if (code !== CURRENT_DEALER.code) {
      return dealerDetails[code] ?? { code, monthlySales: [], leads: [], projects: [], quotes: [] };
    }
    // CNX = ข้อมูลสดจาก SalesContext ทั้งหมด
    const quotes: DealerQuoteItem[] = quotations.map(q => ({
      quoteNo: q.id, customer: q.customer, product: q.buildingType || q.project,
      valueNum: q.totalValue, status: q.status, date: fmtISOToThai(q.date),
    }));
    const leadItems: DealerLeadItem[] = leads.map(l => ({
      id: l.id, name: l.company || l.name, province: l.province, product: l.product,
      valueNum: parseBaht(l.value), status: LEAD_TO_ITEM[l.status], assignedAt: l.createdAt ?? "—",
    }));
    const projects: DealerProjectItem[] = leads.filter(l => l.status !== "CANCELLED").map(l => ({
      id: l.id, name: l.company || l.name, product: l.product, valueNum: parseBaht(l.value),
      progress: LEAD_PROGRESS[l.status], status: l.status === "PAID" ? "completed" : "in_progress",
      dueDate: l.expectedClose ?? "—",
    }));
    // ยอดขายรายเดือน (พันบาท) จากใบเสนอราคาที่ปิดได้ · แสดง ม.ค.–มิ.ย. (mock วันนี้ = มิ.ย.)
    const byMonth = new Map<number, number>();
    quotations.forEach(q => {
      if (q.status !== "won") return;
      const m = parseInt((q.date || "").slice(5, 7)) - 1;
      if (!isNaN(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + q.totalValue);
    });
    const monthlySales = TH_MO.slice(0, 6).map((month, i) => ({ month, value: Math.round((byMonth.get(i) ?? 0) / 1000) }));
    return { code, monthlySales, leads: leadItems, projects, quotes };
  }, [code, leads, quotations]);
}
