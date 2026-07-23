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
import { settings as settingsRepo, dealers as dealersRepo } from "@pms/shared/lib/data";
import { useDealerPerformance, EMPTY_PERF } from "@pms/shared/lib/useDealerPerformance";
import { useNetworkLeads, useNetworkQuotations } from "@pms/shared/lib/useNetworkData";
import { buildHQAlerts, type HQAlert } from "@pms/shared/lib/hqAlerts";

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
      ).catch(() => {});
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

/** การแจ้งเตือน 6 ข้อของทั้งเครือ ตามกฎที่เปิดไว้ที่ /hq/settings → การแจ้งเตือน */
export function useHQAlerts(): HQAlert[] {
  const hqRules = useHQRules();
  const networkLeads = useNetworkLeads();
  const networkQuotes = useNetworkQuotations();
  const perf = useDealerPerformance();
  return useMemo(() => {
    if (!hqRules) return [];
    return buildHQAlerts({
      leads: networkLeads, quotes: networkQuotes, dealers: hqRules.dealers,
      rules: hqRules.rules, validityDays: hqRules.validityDays,
      rulesOf: code => leadRulesOf(hqRules.leadRulesMap, code),
      revenueOf: code => (perf.get(code) ?? EMPTY_PERF).revenue,
    });
  }, [hqRules, networkLeads, networkQuotes, perf]);
}
