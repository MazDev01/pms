// ─── การแจ้งเตือน HQ (hook) ────────────────────────────────────────────────────
// แหล่งเดียวของ "กฎแจ้งเตือน 6 ข้อ" ฝั่ง React — คำนวณจริงใน @pms/shared/lib/hqAlerts
// ใช้ร่วมกันระหว่างกระดิ่ง Topbar และการ์ด "ต้องดูด่วน" บนแดชบอร์ด HQ
// (ห้าม usePersistentState: มันเขียนกลับ → ค่า seed จะทับของจริงทุกครั้งที่ mount)
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  leadRulesOf,
  HQ_NOTIF_UPDATED_EVENT, DEALER_LEAD_RULES_EVENT,
  type HQNotifRules, type DealerLeadRulesMap, type DealerRow,
} from "@pms/shared/lib/mock";
import { settings as settingsRepo, dealers as dealersRepo, metrics as metricsRepo } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import { useDealerPerformance, EMPTY_PERF } from "@pms/shared/lib/useDealerPerformance";
import { useNetworkLeads, useNetworkQuotations } from "@pms/shared/lib/useNetworkData";
import { buildHQAlerts, assembleHQAlerts, type HQAlert } from "@pms/shared/lib/hqAlerts";
import type { HQAlertsData } from "@pms/shared/lib/data/ports";

// leadRulesMap = เกณฑ์ของทุกสาขา (ตัวแทนตั้งเอง) — ไม่ใช่ค่าเดียวของ HQ อีกแล้ว
type HQRules = { rules: HQNotifRules; leadRulesMap: DealerLeadRulesMap; validityDays: number; dealers: DealerRow[] };

/** อ่านกฎแจ้งเตือน/เกณฑ์/รายชื่อตัวแทนหลัง mount แล้วติดตามการแก้ที่หน้าตั้งค่า */
export function useHQRules(): HQRules | null {
  const [hqRules, setHqRules] = useState<HQRules | null>(null);
  useEffect(() => {
    // อ่านผ่าน repository (local: localStorage · supabase: DB) — รวมทั้ง 4 แหล่งเป็นชุดเดียว
    const read = () => {
      Promise.all([
        settingsRepo.getNotifRules(),
        settingsRepo.getLeadRulesMap(),
        settingsRepo.getQuoteValidityDays(),
        dealersRepo.list(),
      ]).then(([rules, leadRulesMap, validityDays, dealers]) =>
        setHqRules({ rules, leadRulesMap, validityDays, dealers }),
      // โหลดพลาด = hqRules ค้าง null → การแจ้งเตือน/เกณฑ์ทั้งหมดหายเงียบ ต้องแจ้งเสมอ
      // (ให้ตรงกับ metrics.hqAlerts ในไฟล์เดียวกันที่ทำถูกอยู่แล้ว)
      ).catch(e => logRepoRead("settings.hqRules", e));
    };
    read();
    window.addEventListener(HQ_NOTIF_UPDATED_EVENT, read);
    window.addEventListener(DEALER_LEAD_RULES_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(HQ_NOTIF_UPDATED_EVENT, read);
      window.removeEventListener(DEALER_LEAD_RULES_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return hqRules;
}

// ผู้สมัครกฎแจ้งเตือนจาก DB (M9 Phase 4) — supabase เท่านั้น · local คืน null → ใช้ buildHQAlerts(array) เดิม
// เกณฑ์ต่อสาขา (unassignedAlertHours) ส่งเป็น jsonb เหมือน leads_page/unassigned_leads
function useHQAlertsData(hqRules: HQRules | null): HQAlertsData | null {
  const [data, setData] = useState<HQAlertsData | null>(null);
  const key = hqRules ? JSON.stringify({ r: hqRules.rules, m: hqRules.leadRulesMap, v: hqRules.validityDays, d: hqRules.dealers.map(d => d.code) }) : "";
  useEffect(() => {
    if (DATA_SOURCE !== "supabase" || !hqRules) { setData(null); return; }
    const perDealer: Record<string, number> = {};
    for (const d of hqRules.dealers) perDealer[d.code] = leadRulesOf(hqRules.leadRulesMap, d.code).unassignedAlertHours;
    let alive = true;
    metricsRepo.hqAlerts({
      asOf: APP_NOW_ISO, unassignedPerDealer: perDealer, leadIdleDays: hqRules.rules.leadIdleDays,
      quoteValidityDays: hqRules.validityDays, quoteExpiringDays: hqRules.rules.quoteExpiringDays,
      dealerIdleDays: hqRules.rules.dealerIdleDays,
    }).then(r => { if (alive) setData(r); }).catch(e => logRepoRead("metrics.hqAlerts", e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data;
}

/** การแจ้งเตือน 6 ข้อของทั้งเครือ ตามกฎที่เปิดไว้ที่ /hq/settings → การแจ้งเตือน */
export function useHQAlerts(): HQAlert[] {
  const hqRules = useHQRules();
  const networkLeads = useNetworkLeads();
  const networkQuotes = useNetworkQuotations();
  const perf = useDealerPerformance();
  const alertsData = useHQAlertsData(hqRules); // supabase: จาก DB · local/ยังไม่กลับ: null
  return useMemo(() => {
    if (!hqRules) return [];
    const revenueOf = (code: string) => (perf.get(code) ?? EMPTY_PERF).revenue;
    // supabase: ประกอบจากผู้สมัครที่ DB (ไม่พึ่ง array ทั้งเครือ) · local: คิดจาก array เหมือนเดิม
    if (alertsData) return assembleHQAlerts(alertsData, { dealers: hqRules.dealers, rules: hqRules.rules, revenueOf });
    return buildHQAlerts({
      leads: networkLeads, quotes: networkQuotes, dealers: hqRules.dealers,
      rules: hqRules.rules, validityDays: hqRules.validityDays,
      rulesOf: code => leadRulesOf(hqRules.leadRulesMap, code),
      revenueOf,
    });
  }, [hqRules, alertsData, networkLeads, networkQuotes, perf]);
}
