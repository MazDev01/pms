"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

// state ที่ persist ลง localStorage จริง (SSR-safe) — โหลดค่าที่บันทึกไว้ตอน mount, บันทึกทุกครั้งที่เปลี่ยน
// ใช้แทน useState สำหรับข้อมูลที่ต้อง "ไม่หายเมื่อ refresh" (เช่น จัดการสาขา/ผู้ใช้/สินค้า HQ)
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const hydrated = useRef(false);

  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setState(JSON.parse(s) as T); } catch {}
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return; // อย่าเพิ่งเขียนทับด้วยค่า default ก่อนโหลดเสร็จ
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);

  return [state, setState];
}
