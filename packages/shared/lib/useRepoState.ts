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

// เหมือน useRepoValue แต่บอกด้วยว่าโหลดเสร็จหรือยัง
// จำเป็นเมื่อ "ไม่เจอข้อมูล" กับ "ยังโหลดไม่เสร็จ" ต้องแยกกัน — เช่นหน้าที่ตัดสินใจ 404
// (ถ้าไม่แยก หน้าจะเด้ง 404 ตั้งแต่เรนเดอร์แรกที่ค่ายังว่างอยู่เสมอ)
export function useRepoValueLoaded<T>(load: () => Promise<T>, initial: T): { value: T; loaded: boolean } {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((v) => { if (alive) { setValue(v); setLoaded(true); } })
      .catch((e) => { if (alive) { console.error("[useRepoValueLoaded.load]", e); setLoaded(true); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { value, loaded };
}
