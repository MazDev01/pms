"use client";

// ตั้งค่าของสาขาที่ล็อกอินอยู่ — หัวกระดาษ/เอกสาร/โลโก้/แจ้งเตือน
//
// เดิมทุกอย่างอยู่ใน localStorage ของเบราว์เซอร์เครื่องที่ใช้:
//   ล้างเบราว์เซอร์ · เปลี่ยนเครื่อง · เปิดคนละเบราว์เซอร์ = หายหมด
//   ใบเสนอราคาที่ส่งลูกค้าจะไม่มีชื่อบริษัท ไม่มีตราประทับ ไม่มีลายเซ็น
// ตอนนี้อ่าน/เขียนผ่าน repository → โหมด supabase เก็บที่ DB ผูกกับรหัสสาขา
import { useCallback, useEffect, useState } from "react";
import { dealerSettings as repo } from "./data";
import { useCurrentDealer } from "./useCurrentDealer";
import { DEFAULT_ISSUER, DEFAULT_NOTIF_PREFS, NOTIF_PREFS_EVENT } from "./mock";
import { DEFAULT_DOC } from "./quotationPrint";
import type { DealerSettings } from "./data/types";

export const EMPTY_DEALER_SETTINGS: DealerSettings = {
  issuer: DEFAULT_ISSUER,
  document: DEFAULT_DOC,
  wordmark: "",
  logo: "",
  notifPrefs: DEFAULT_NOTIF_PREFS,
};

/** แจ้งหน้าอื่นใน origin เดียวกันว่าตั้งค่าสาขาเปลี่ยน (โหมด local ไม่มี Realtime) */
export const DEALER_SETTINGS_EVENT = "pms:dealer-settings";

export type UseDealerSettings = {
  settings: DealerSettings;
  /** โหลดเสร็จหรือยัง — ฟอร์มควรรอก่อนแสดง ไม่งั้นผู้ใช้เห็นค่ากลางแล้วเผลอกดบันทึกทับ */
  loaded: boolean;
  save: (patch: Partial<DealerSettings>) => Promise<void>;
};

export function useDealerSettings(): UseDealerSettings {
  const dealer = useCurrentDealer();
  const [settings, setSettings] = useState<DealerSettings>(EMPTY_DEALER_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () => {
      repo.get(dealer.code)
        .then(v => { if (alive) { setSettings(v); setLoaded(true); } })
        .catch(e => { if (alive) console.error("[dealerSettings.get]", e); });
    };
    read();
    const onEvt = () => read();
    window.addEventListener(DEALER_SETTINGS_EVENT, onEvt);
    // หน้าตั้งค่ายิง event นี้ตอนกดบันทึกการแจ้งเตือน (กระดิ่งบน Topbar ต้องอัปเดตทันที)
    window.addEventListener(NOTIF_PREFS_EVENT, onEvt);
    window.addEventListener("storage", onEvt);
    return () => {
      alive = false;
      window.removeEventListener(DEALER_SETTINGS_EVENT, onEvt);
      window.removeEventListener(NOTIF_PREFS_EVENT, onEvt);
      window.removeEventListener("storage", onEvt);
    };
  }, [dealer.code]);

  const save = useCallback(async (patch: Partial<DealerSettings>) => {
    // แสดงผลทันที แล้วค่อยเขียนลงที่เก็บ (เขียนไม่ผ่านจะ throw ให้ผู้เรียกจัดการ)
    setSettings(prev => ({ ...prev, ...patch }));
    await repo.save(dealer.code, patch);
    try { window.dispatchEvent(new Event(DEALER_SETTINGS_EVENT)); } catch {}
  }, [dealer.code]);

  return { settings, loaded, save };
}
