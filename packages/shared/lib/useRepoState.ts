"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

// state ที่ผูกกับ repository (data layer) — drop-in แทน usePersistentState สำหรับข้อมูลระดับเครือ (HQ)
//   • โหลดจาก repo ตอน mount (async) · เขียนกลับผ่าน repo ทุกครั้งที่เปลี่ยน (หลัง hydrate)
//   • โหมด local: repo = LocalAdapter (localStorage) → พฤติกรรมเท่า usePersistentState เดิมเป๊ะ
//   • โหมด supabase: repo = DB (RLS) → อ่าน/เขียนจริงข้ามเครื่อง
//
// hydrated เป็น state (ไม่ใช่ ref) จงใจ — กันเขียนค่า default ทับก่อนโหลดเสร็จ (กติกาเดียวกับ usePersistentState)
export function useRepoState<T>(
  load: () => Promise<T>,
  save: (value: T) => void,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((v) => { if (alive) { setState(v); setHydrated(true); } })
      .catch((e) => { if (alive) { console.error("[useRepoState.load]", e); setHydrated(true); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return; // อย่าเพิ่งเขียนทับด้วยค่า default ก่อนโหลดเสร็จ
    save(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated]);

  return [state, setState];
}

// อ่านอย่างเดียว (ไม่เขียนกลับ) — สำหรับหน้าที่แค่แสดงผลข้อมูลระดับเครือ
export function useRepoValue<T>(load: () => Promise<T>, initial: T): T {
  const [state] = useRepoState<T>(load, () => {}, initial);
  return state;
}
