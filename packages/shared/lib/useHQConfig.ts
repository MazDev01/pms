"use client";

// ─── ค่าคุมระดับเครือที่ HQ เป็นเจ้าของ — ฝั่งตัวแทน "อ่านอย่างเดียว" ──────────────
// VAT / อายุใบเสนอราคา / เป้ายอดขาย ตั้งที่ /hq/settings แล้วมีผลกับทุกสาขา
//
// ทำไมต้องเป็น hook (ห้ามเรียก loadHQPolicy() ตรง ๆ ตอน render อีก):
//   loadHQPolicy/loadHQTargets อ่าน localStorage ของ origin ตัวเอง → โหมด supabase
//   จะได้ "ค่า default" เสมอ ไม่ใช่ค่าที่ HQ ตั้งไว้จริงใน DB → VAT/วันหมดอายุคลาดเคลื่อน (คิดเงินผิด)
//   hook นี้อ่านผ่าน repository + ติดตามการแก้ (Realtime ฝั่ง supabase · event ฝั่ง local)
import { useEffect, useState } from "react";
import {
  DEFAULT_HQ_POLICY, DEFAULT_HQ_TARGETS, HQ_SETTINGS_EVENT, LOST_REASONS,
  type HQPolicy, type HQTargets,
} from "./mock";
import { settings as settingsRepo, realtime } from "./data";

// โครงร่วม: โหลดค่าผ่าน repo แล้วโหลดซ้ำเมื่อ HQ แก้
function useHQValue<T>(load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const read = () => { load().then(v => { if (alive) setValue(v); }).catch(() => {}); };
    read();
    const unsub = realtime.subscribeSettings(read); // supabase: ข้ามแอป/ข้ามเครื่อง · local: no-op
    window.addEventListener(HQ_SETTINGS_EVENT, read); // local: HQ กดบันทึกใน origin เดียวกัน
    window.addEventListener("storage", read);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener(HQ_SETTINGS_EVENT, read);
      window.removeEventListener("storage", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** นโยบายการขายของ HQ (VAT ฯลฯ) — ตัวแทนตั้งเองไม่ได้ */
export function useHQPolicy(): HQPolicy {
  return useHQValue<HQPolicy>(() => settingsRepo.getPolicy(), DEFAULT_HQ_POLICY);
}

/** เป้ายอดขายของเครือ — แดชบอร์ดตัวแทนใช้เทียบความคืบหน้า */
export function useHQTargets(): HQTargets {
  return useHQValue<HQTargets>(() => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);
}

/** อายุใบเสนอราคา (วัน) — ใช้คำนวณวันหมดอายุของใบ */
export function useQuoteValidityDays(): number {
  return useHQValue<number>(() => settingsRepo.getQuoteValidityDays(), DEFAULT_HQ_POLICY.quoteValidityDays);
}

/** เหตุผล "ปิดการขายไม่สำเร็จ" ที่ HQ กำหนด — ตัวแทนเลือกจากรายการนี้เท่านั้น
 *  เดิมอ่าน localStorage ตรง ๆ ซึ่งเป็นคนละ origin กับที่ HQ เขียน → ค่าที่ตั้งไม่เคยไปถึงตัวแทน */
export function useLostReasons(): string[] {
  return useHQValue<string[]>(() => settingsRepo.getLostReasons(), [...LOST_REASONS]);
}
