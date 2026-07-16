"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

// state ที่ persist ลง localStorage จริง (SSR-safe) — โหลดค่าที่บันทึกไว้ตอน mount, บันทึกทุกครั้งที่เปลี่ยน
// ใช้แทน useState สำหรับข้อมูลที่ต้อง "ไม่หายเมื่อ refresh" (เช่น จัดการสาขา/ผู้ใช้/สินค้า HQ)
//
// hydrated เป็น state ไม่ใช่ ref — จงใจ:
//   ถ้าใช้ ref, พอ effect โหลดค่าตั้ง hydrated.current = true เสร็จ effect เขียนที่รันต่อใน commit เดียวกัน
//   จะเห็น state เป็น "ค่าเริ่มต้น" (closure เก่า) แล้วเขียนทับค่าที่เพิ่งโหลดมาทันที
//   พอ React รัน effect ซ้ำ (dev/StrictMode) รอบสองจะอ่านค่าที่ถูกทับไปแล้ว → ค่าที่ผู้ใช้บันทึกไว้หายถาวร
//   (เจอจริงตอนทดสอบ: ตั้งกฎ 1000 วัน → เปิดหน้าตั้งค่าใหม่ → เด้งกลับเป็น 7)
//   ใช้ state แทน: commit แรก hydrated = false จึงยังไม่เขียน · เขียนรอบแรกเกิดหลังค่าที่โหลดถูก commit แล้ว
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setState(JSON.parse(s) as T); } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return; // อย่าเพิ่งเขียนทับด้วยค่า default ก่อนโหลดเสร็จ
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state, hydrated]);

  return [state, setState];
}
