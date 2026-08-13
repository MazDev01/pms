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
  DEFAULT_HQ_POLICY, DEFAULT_HQ_TARGETS, HQ_SETTINGS_EVENT, LOST_REASONS, LEAD_TASK_TEMPLATE,
  type HQPolicy, type HQTargets, type LeadTaskDef,
} from "./mock";
import { settings as settingsRepo, realtime } from "./data";
import { logRepoRead } from "./repoLog";

// โครงร่วม: โหลดค่าผ่าน repo แล้วโหลดซ้ำเมื่อ HQ แก้
//
// tag: ชื่อที่ใช้แจ้งเมื่อโหลดไม่สำเร็จ — ต้องแจ้งเสมอ ห้ามกลืนเงียบ
//   เดิม .catch(() => {}) ทิ้ง error ทั้งดุ้น → พอโหลดนโยบายพลาด ระบบจะ fallback เป็นค่า default
//   ในโค้ดเงียบ ๆ โดยผู้ใช้ไม่รู้ตัว · ค่าพวกนี้คือ VAT กับอายุใบเสนอราคา = ออกใบด้วยเลขผิดได้จริง
//   (พบจากผลตรวจสอบระบบ 5 ส.ค. 69 · แพตเทิร์นเดียวกับที่เคยแก้ไปแล้วใน SalesContext/useNetworkData)
function useHQValue<T>(tag: string, load: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    const read = () => { load().then(v => { if (alive) setValue(v); }).catch(e => logRepoRead(tag, e)); };
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
  return useHQValue<HQPolicy>("settings.getPolicy", () => settingsRepo.getPolicy(), DEFAULT_HQ_POLICY);
}

/** เป้ายอดขายของเครือ — แดชบอร์ดตัวแทนใช้เทียบความคืบหน้า */
export function useHQTargets(): HQTargets {
  return useHQValue<HQTargets>("settings.getTargets", () => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);
}

/** อายุใบเสนอราคา (วัน) — ใช้คำนวณวันหมดอายุของใบ */
export function useQuoteValidityDays(): number {
  return useHQValue<number>("settings.getQuoteValidityDays",
    () => settingsRepo.getQuoteValidityDays(), DEFAULT_HQ_POLICY.quoteValidityDays);
}

/** เหตุผล "ปิดการขายไม่สำเร็จ" ที่ HQ กำหนด — ตัวแทนเลือกจากรายการนี้เท่านั้น
 *  เดิมอ่าน localStorage ตรง ๆ ซึ่งเป็นคนละ origin กับที่ HQ เขียน → ค่าที่ตั้งไม่เคยไปถึงตัวแทน */
export function useLostReasons(): string[] {
  return useHQValue<string[]>("settings.getLostReasons", () => settingsRepo.getLostReasons(), [...LOST_REASONS]);
}

/** งานมาตรฐานของแต่ละขั้น ที่ HQ ตั้งไว้ — ตัวแทนเช็กงานชุดนี้ และเป็นตัวเลื่อนขั้นให้ลีด
 *  ห้ามใช้ LEAD_TASK_TEMPLATE ตรง ๆ ในหน้าจอ: นั่นเป็นแค่ค่าเริ่มต้น ไม่ใช่ของที่ HQ ตั้งไว้จริง */
export function useLeadTaskTemplate(): LeadTaskDef[] {
  return useHQValue<LeadTaskDef[]>("settings.getLeadTasks", () => settingsRepo.getLeadTasks(), [...LEAD_TASK_TEMPLATE]);
}
