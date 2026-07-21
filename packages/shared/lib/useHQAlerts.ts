// ─── การแจ้งเตือน HQ (hook) ────────────────────────────────────────────────────
// แหล่งเดียวของ "กฎแจ้งเตือน 6 ข้อ" ฝั่ง React — คำนวณจริงใน @pms/shared/lib/hqAlerts
// ใช้ร่วมกันระหว่างกระดิ่ง Topbar และการ์ด "ต้องดูด่วน" บนแดชบอร์ด HQ
// (ห้าม usePersistentState: มันเขียนกลับ → ค่า seed จะทับของจริงทุกครั้งที่ mount)
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadHQNotifRules, loadDealerLeadRulesMap, leadRulesOf, loadQuoteValidityDays, loadHQDealers,
  HQ_NOTIF_UPDATED_EVENT, DEALER_LEAD_RULES_EVENT,
  type HQNotifRules, type DealerLeadRulesMap, type DealerRow,
} from "@pms/shared/lib/mock";
import { useNetworkLeads, useNetworkQuotations } from "@pms/shared/lib/useNetworkData";
import { buildHQAlerts, type HQAlert } from "@pms/shared/lib/hqAlerts";

// leadRulesMap = เกณฑ์ของทุกสาขา (ตัวแทนตั้งเอง) — ไม่ใช่ค่าเดียวของ HQ อีกแล้ว
type HQRules = { rules: HQNotifRules; leadRulesMap: DealerLeadRulesMap; validityDays: number; dealers: DealerRow[] };

/** อ่านกฎแจ้งเตือน/เกณฑ์/รายชื่อตัวแทนหลัง mount แล้วติดตามการแก้ที่หน้าตั้งค่า */
export function useHQRules(): HQRules | null {
  const [hqRules, setHqRules] = useState<HQRules | null>(null);
  useEffect(() => {
    const read = () => setHqRules({
      rules: loadHQNotifRules(),
      leadRulesMap: loadDealerLeadRulesMap(),
      validityDays: loadQuoteValidityDays(),
      dealers: loadHQDealers(),
    });
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
  return useMemo(() => {
    if (!hqRules) return [];
    return buildHQAlerts({
      leads: networkLeads, quotes: networkQuotes, dealers: hqRules.dealers,
      rules: hqRules.rules, validityDays: hqRules.validityDays,
      rulesOf: code => leadRulesOf(hqRules.leadRulesMap, code),
    });
  }, [hqRules, networkLeads, networkQuotes]);
}
