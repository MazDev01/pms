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
import { useMemo, useEffect, useState } from "react";
import { useNetworkQuotations, useNetworkLeads } from "./useNetworkData";
import { parseThaiDate, needsFollowUp, isLeadOpen } from "./leadMetrics";
import { useRepoValue } from "./useRepoState";
import { useSales } from "@pms/shared/context/SalesContext";
import { settings as settingsRepo, metrics as metricsRepo } from "./data";
import { DATA_SOURCE } from "./data/config";
import { logRepoRead } from "./repoLog";
import type { DealerRollup, DealerRollupOpts } from "./data/ports";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { DEFAULT_LEAD_RULES, type LeadStatus, type DealerLeadRulesMap } from "./mock";

// rollup รายสาขาจาก DB (M9 Phase 1) — supabase เท่านั้น
//   • รวมยอดที่ DB (RPC dealer_rollup) แทนการวนรวมทุกแถวฝั่ง client
//   • reactive/invalidation: refetch เมื่อ leads/quotations ใน SalesContext เปลี่ยน (write/realtime/โหลด)
//     → ตัวเลขบนจอไม่ค้างหลังสร้าง/ปิดใบ · debounce รวมการเปลี่ยนถี่ ๆ ให้ยิง RPC ครั้งเดียว
//   • ยังพึ่ง array ที่โหลดอยู่เป็น "สัญญาณเปลี่ยน" (transitional) — เฟสถัดไปตัด array แล้วเปลี่ยนไปฟัง realtime ตรง
//   • โหมด local คืน null → useDealerPerformance คงเส้นทางคำนวณ client เดิม (เดโมผสม seed สาขาอื่น ห้ามหาย)
function useDealerRollup(year: number, opts: DealerRollupOpts): Map<string, DealerRollup> | null {
  const { salesVersion } = useSales();
  const optsKey = JSON.stringify(opts);
  const [rollup, setRollup] = useState<Map<string, DealerRollup> | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setRollup(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo.dealerRollup(year, opts)
        .then(r => { if (alive) setRollup(r); })
        .catch(e => logRepoRead("metrics.dealerRollup", e));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, optsKey, salesVersion]);
  return rollup;
}

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
  // rollup จาก DB (supabase เท่านั้น · local = null) — แหล่งจริงของ quotes/won/lost/revenue/openLeads + stale (onTimePct)
  // ส่งเกณฑ์รายสาขา (rules) + as_of ให้ DB คิด stale = needsFollowUp (ตอนนี้มี last_contact_at แล้ว · 0046)
  const rollupOpts = useMemo<DealerRollupOpts>(() => ({
    asOf: `${APP_NOW.getFullYear()}-${String(APP_NOW.getMonth() + 1).padStart(2, "0")}-${String(APP_NOW.getDate()).padStart(2, "0")}`,
    defaultDays: DEFAULT_LEAD_RULES.followUpAlertDays,
    perDealer: Object.fromEntries(Object.entries(rules).map(([code, r]) => [code, r.followUpAlertDays])),
  }), [rules]);
  const serverRollup = useDealerRollup(APP_NOW.getFullYear(), rollupOpts);

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
    const onTime = (code: string, openLeads: number) => openLeads > 0
      ? Math.round(((openLeads - (stale.get(code) ?? 0)) / openLeads) * 100)
      : null;
    for (const [code, r] of m) {
      const closed = r.won + r.lost;
      r.winRate = closed ? Math.round((r.won / closed) * 100) : null;
      r.onTimePct = onTime(code, r.openLeads);
    }

    // supabase: ยึด rollup จาก DB เป็นแหล่งจริงของ quotes/won/lost/revenue/openLeads + onTimePct (จาก stale)
    //   ค่าที่คำนวณ client ด้านบนเป็นค่าเริ่มต้น (กันจอว่างระหว่าง RPC ยังไม่กลับ) แล้ว DB ทับเมื่อพร้อม
    if (serverRollup) {
      for (const [code, sr] of serverRollup) {
        const r = get(code);
        r.quotes = sr.quotes; r.won = sr.won; r.lost = sr.lost; r.revenue = sr.revenue; r.openLeads = sr.openLeads;
        const closed = sr.won + sr.lost;
        r.winRate = closed ? Math.round((sr.won / closed) * 100) : null;
        r.onTimePct = sr.openLeads > 0 ? Math.round(((sr.openLeads - sr.staleLeads) / sr.openLeads) * 100) : null;
      }
    }
    return m;
  }, [quotes, leads, rules, serverRollup]);
}

/** % ความคืบหน้าเทียบเป้าทั้งปี — ไม่มีเป้า = null (แสดง "—" ไม่ใช่ 0%) */
export function targetPct(revenue: number, annualTarget: number): number | null {
  if (!annualTarget || annualTarget <= 0) return null;
  return Math.round((revenue / annualTarget) * 100);
}
