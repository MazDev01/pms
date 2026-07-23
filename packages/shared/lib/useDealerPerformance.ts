"use client";

// ผลงานรายตัวแทน — คำนวณจากใบเสนอราคาจริงเสมอ (แหล่งเดียวของทั้งระบบ)
//
// ปัญหาเดิม: ตาราง dealers มีคอลัมน์ revenue_actual / win_rate / active_projects / on_time_pct
// ซึ่งเป็นค่าคงที่ที่ถูก seed ไว้ตั้งแต่ตอนทำเดโม แล้ว 5 หน้าเอามาแสดงเป็น "ยอดขายจริง"
//   → /hq/dashboard คำนวณจากใบจริงได้ ฿0 แต่ /hq/dealers อ่านคอลัมน์ได้ ฿22.4M ของสาขาเดียวกัน
//   → ตัวเลขไม่ขยับตามข้อมูล และไม่มีวันตรงกันเองระหว่างหน้า
//
// นิยามกลาง (ห้ามคำนวณเองซ้ำในหน้าใด):
//   ยอดขาย   = Σ มูลค่าใบที่สถานะ "ปิดการขายได้" ของสาขานั้น
//   อัตราปิด  = ปิดได้ ÷ (ปิดได้ + ปิดไม่ได้) · ยังไม่มีใบรู้ผล = null (แสดง "—" ไม่ใช่ 0%)
//   โอกาสที่ดำเนินอยู่ = ลีดที่ยังไม่ปิด (ไม่ใช่ "โครงการ" — ระบบนี้จบที่ปิดการขาย)
//   % เป้า    = ยอดปิดได้สะสมทั้งปี ÷ เป้าทั้งปีที่ HQ ตั้ง (เป้าเป็นรายปี ห้ามหดตามตัวกรองเวลา)
import { useMemo } from "react";
import { useNetworkQuotations, useNetworkLeads } from "./useNetworkData";
import { parseThaiDate, needsFollowUp, isLeadOpen } from "./leadMetrics";
import { useRepoValue } from "./useRepoState";
import { settings as settingsRepo } from "./data";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { DEFAULT_LEAD_RULES, type LeadStatus, type DealerLeadRulesMap } from "./mock";

export type DealerPerf = {
  /** ยอดขายสะสมทั้งปีนี้ (บาท) — จากใบที่ปิดการขายได้จริง */
  revenue: number;
  /** จำนวนใบเสนอราคาทั้งหมดของสาขา */
  quotes: number;
  won: number;
  lost: number;
  /** อัตราปิดการขาย % · null = ยังไม่มีใบที่รู้ผล */
  winRate: number | null;
  /** โอกาสการขายที่ยังดำเนินอยู่ (ลีดที่ยังไม่ปิด) */
  openLeads: number;
  /** ติดตามตรงเวลา % = ลีดที่ยังไม่ค้างติดต่อ ÷ ลีดที่เปิดอยู่ · null = ยังไม่มีลีดให้วัด
   *  เกณฑ์ "ค้างกี่วัน" เป็นของแต่ละสาขา (ตั้งเองที่ ตั้งค่า › การแจ้งเตือน) */
  onTimePct: number | null;
};

export const EMPTY_PERF: DealerPerf = { revenue: 0, quotes: 0, won: 0, lost: 0, winRate: null, openLeads: 0, onTimePct: null };

const CLOSED: LeadStatus[] = ["PAID", "CANCELLED"];

/** ผลงานของทุกสาขา — key = dealerCode */
export function useDealerPerformance(): Map<string, DealerPerf> {
  const quotes = useNetworkQuotations();
  const leads = useNetworkLeads();
  // เกณฑ์ค้างติดต่อของแต่ละสาขา — สาขาที่ไม่ได้ตั้งเองใช้ค่ากลาง
  const rules = useRepoValue<DealerLeadRulesMap>(() => settingsRepo.getLeadRulesMap(), {});

  return useMemo(() => {
    const m = new Map<string, DealerPerf>();
    const get = (code: string) => {
      let r = m.get(code);
      if (!r) { r = { ...EMPTY_PERF }; m.set(code, r); }
      return r;
    };

    for (const q of quotes) {
      const r = get(q.dealerCode);
      r.quotes += 1;
      if (q.status === "won") {
        r.won += 1;
        // ยอดขาย = ของ "ปีนี้" เท่านั้น เพื่อให้เทียบกับเป้ารายปีได้ตรง ๆ
        const d = parseThaiDate(q.createdAt);
        if (d && d.getFullYear() === APP_NOW.getFullYear()) r.revenue += q.valueNum;
      }
      if (q.status === "lost") r.lost += 1;
    }
    const stale = new Map<string, number>();
    for (const l of leads) {
      if (CLOSED.includes(l.status) || !isLeadOpen(l)) continue;
      const code = l.dealerCode ?? "CNX";
      get(code).openLeads += 1;
      const days = (rules[code] ?? DEFAULT_LEAD_RULES).followUpAlertDays;
      if (needsFollowUp(l, days)) stale.set(code, (stale.get(code) ?? 0) + 1);
    }
    for (const [code, r] of m) {
      const closed = r.won + r.lost;
      r.winRate = closed ? Math.round((r.won / closed) * 100) : null;
      r.onTimePct = r.openLeads > 0
        ? Math.round(((r.openLeads - (stale.get(code) ?? 0)) / r.openLeads) * 100)
        : null;
    }
    return m;
  }, [quotes, leads, rules]);
}

/** % ความคืบหน้าเทียบเป้าทั้งปี — ไม่มีเป้า = null (แสดง "—" ไม่ใช่ 0%) */
export function targetPct(revenue: number, annualTarget: number): number | null {
  if (!annualTarget || annualTarget <= 0) return null;
  return Math.round((revenue / annualTarget) * 100);
}
