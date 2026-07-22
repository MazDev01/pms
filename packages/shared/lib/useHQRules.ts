"use client";

// ─── กฎการดูแลลูกค้าเป้าหมาย — ตัวแทนตั้งเอง แยกรายสาขา ────────────────────────
// ⚠️ เจ้าของกฎเปลี่ยนแล้ว (บอสสั่ง): เดิม HQ ตั้งค่าเดียวที่ /hq/settings บังคับทุกสาขา
//    ตอนนี้แต่ละสาขาตั้งของตัวเองที่ /settings → "การแจ้งเตือน" · HQ ตั้งให้ไม่ได้แล้ว
//    → ไม่มี "เกณฑ์ของทั้งเครือ" อีกต่อไป ทุกจุดต้องถามด้วยรหัสสาขาเสมอ
//    หน้า HQ ที่รวมลีดหลายสาขาจะมีหลายเกณฑ์ปนกัน — ห้ามเขียนป้ายว่า "ภายใน N ชั่วโมง" ลอย ๆ
//
// ห้ามใช้ usePersistentState ที่นี่ — hook นั้น "เขียนกลับ" ลง localStorage ด้วย
// หน้าที่แค่อ่านกฎ (แดชบอร์ด/หน้าลีด) จะเขียนค่า default ทับค่าที่ตั้งไว้ตอน mount
// (เจอจริงตอนทดสอบ: ตั้ง 1000 วัน → เปิดแดชบอร์ดตัวแทน → ค่าเด้งกลับเป็น 7)
// ที่นี่จึงอ่านอย่างเดียว + ฟัง event ตอนกดบันทึก และ storage ตอนเปลี่ยนจากแท็บอื่น
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  leadRulesOf, DEALER_LEAD_RULES_EVENT,
  type LeadRules, type DealerLeadRulesMap,
} from "@pms/shared/lib/mock";
import { settings as settingsRepo } from "@pms/shared/lib/data";

/** แผนที่กฎของทุกสาขา — ใช้ในหน้า HQ ที่รวมลีดหลายสาขาไว้ด้วยกัน */
export function useDealerLeadRulesMap(): DealerLeadRulesMap {
  // เริ่มที่ว่างเสมอ → SSR กับ client render แรกตรงกัน (กัน hydration mismatch)
  const [map, setMap] = useState<DealerLeadRulesMap>({});
  useEffect(() => {
    // อ่านผ่าน repository (local: localStorage · supabase: DB)
    const read = () => { settingsRepo.getLeadRulesMap().then(setMap).catch(() => {}); };
    read();
    window.addEventListener(DEALER_LEAD_RULES_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(DEALER_LEAD_RULES_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return map;
}

/** ถามกฎรายสาขา — หน้า HQ ใช้กับลีดทีละใบ: rulesOf(lead.dealerCode) */
export function useLeadRulesOf(): (dealerCode: string | undefined) => LeadRules {
  const map = useDealerLeadRulesMap();
  return useCallback((code: string | undefined) => leadRulesOf(map, code), [map]);
}

/** กฎของสาขาเดียว — หน้าฝั่งตัวแทนส่งรหัสสาขาตัวเองเข้ามา */
export function useLeadRules(dealerCode: string): LeadRules {
  const map = useDealerLeadRulesMap();
  return useMemo(() => leadRulesOf(map, dealerCode), [map, dealerCode]);
}
