"use client";

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import { logRepoRead } from "./repoLog";

// state ที่ผูกกับ repository (data layer) — drop-in แทน usePersistentState สำหรับข้อมูลระดับเครือ (HQ)
//   • โหลดจาก repo ตอน mount (async) · เขียนกลับ "เฉพาะเมื่อผู้ใช้แก้จริง" หลังโหลดสำเร็จแล้ว
//   • โหมด local: repo = LocalAdapter (localStorage) → พฤติกรรมเท่า usePersistentState เดิมเป๊ะ
//   • โหมด supabase: repo = DB (RLS) → อ่าน/เขียนจริงข้ามเครื่อง
// การบันทึกล้มเหลวของข้อมูลระดับเครือ — แจ้งผ่าน event เดียวกันทั้งแอป
// (SalesContext มี syncError ของตัวเองสำหรับงานขายอยู่แล้ว · นี่คือคู่ขนานสำหรับ repo อื่น)
export const REPO_SAVE_ERROR_EVENT = "pms:repo-save-error";
export function reportRepoSaveError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[useRepoState.save]", e);
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(REPO_SAVE_ERROR_EVENT, { detail: msg })); } catch {}
}

export function useRepoState<T>(
  load: () => Promise<T>,
  save: (value: T) => void,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  // "โหลดสำเร็จแล้ว" เท่านั้นจึงจะเขียนกลับได้ — โหลดล้มเหลวไม่นับ
  // เดิมใช้ hydrated ตัวเดียวและตั้งเป็น true ใน .catch ด้วย → query ล้ม (เน็ตหลุด/RLS ปฏิเสธ)
  // แล้ว effect ข้างล่างยิง save(state) ทันทีโดยที่ state ยังเป็นค่า initial
  // = เอาค่าตั้งต้น (ซึ่งบางหน้าเป็นชุด mock) upsert ทับของจริงใน DB
  const [loaded, setLoaded] = useState(false);
  // กันเขียนซ้ำโดยไม่มีใครสั่ง: หลังโหลดเสร็จ state เปลี่ยนค่าเพราะ "ผลลัพธ์การโหลด" ไม่ใช่การแก้ของผู้ใช้
  // ถ้า save ทุกครั้งที่ state เปลี่ยน จะ upsert ทั้งตารางกลับไปทุกครั้งที่เปิดหน้า
  const dirtyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    load()
      // ผู้ใช้แก้ไปแล้วระหว่างที่ยังโหลดไม่เสร็จ → ผลการโหลดต้องไม่ทับของที่เขาเพิ่งทำ
      // (เช่น กด "เพิ่มตัวแทน" เร็วกว่าทะเบียนโหลดจบ — เดิมสาขาใหม่หายเงียบ ๆ)
      //
      // ปลอดภัยแล้วเพราะ save() เป็น upsert อย่างเดียว ไม่ลบแถวที่ไม่ได้ส่งไป
      // (ตอนที่ save ยังเป็น "แทนที่ทั้งชุด" การเก็บของผู้ใช้ไว้แบบนี้เคยกลายเป็น
      //  คำสั่งลบสาขาจริงทั้งหมด เพราะ state มีแค่แถวใหม่แถวเดียว)
      .then((v) => {
        if (!alive) return;
        if (!dirtyRef.current) setState(v);
        setLoaded(true);
      })
      .catch((e) => { if (alive) logRepoRead("useRepoState.load", e); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ห่อ setState เพื่อรู้ว่าการเปลี่ยนครั้งนี้มาจากผู้ใช้ (ไม่ใช่จากการโหลด)
  const setAndMark = useCallback<Dispatch<SetStateAction<T>>>((v) => {
    dirtyRef.current = true;
    setState(v);
  }, []);

  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    // การบันทึกล้มเหลวต้องดัง — เดิมเป็น fire-and-forget: RLS ปฏิเสธ/เน็ตหลุดแล้วเงียบสนิท
    // ผู้ใช้เห็นของหายจากจอ (state เปลี่ยนแล้ว) แล้วเข้าใจว่าลบสำเร็จ ทั้งที่ DB ไม่ได้ถูกแตะ
    try {
      const r = save(state) as unknown;
      if (r && typeof (r as Promise<void>).then === "function") {
        void (r as Promise<void>).catch(e => reportRepoSaveError(e));
      }
    } catch (e) { reportRepoSaveError(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded]);

  return [state, setAndMark];
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
      .catch((e) => { if (alive) { logRepoRead("useRepoValueLoaded.load", e); setLoaded(true); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { value, loaded };
}
