"use client";

// โน้ตของลูกค้า — เดิมไม่มีที่เก็บจริงเลย มีแต่ชุดตัวอย่างใน mock.ts
// โหมด supabase จึงต้องปิดแท็บโน้ตไว้เฉย ๆ (ผู้ใช้จดอะไรไม่ได้)
// ตอนนี้เก็บที่ตาราง customer_notes ผูกกับสาขา (RLS: สาขาเห็น/แก้ของตัวเอง · HQ อ่านได้)
import { useCallback, useEffect, useState } from "react";
import { logRepoRead } from "./repoLog";
import { notes as repo, realtime } from "./data";
import { useCurrentDealer } from "./useCurrentDealer";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import type { CustomerNote } from "./data/types";

export type UseCustomerNotes = {
  notes: CustomerNote[];
  loaded: boolean;
  add: (n: Pick<CustomerNote, "title" | "content" | "category" | "color"> & { customerId?: number }) => Promise<void>;
  update: (n: CustomerNote) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

export function useCustomerNotes(author = ""): UseCustomerNotes {
  const dealer = useCurrentDealer();
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  const read = useCallback(() => {
    repo.list({ dealerCode: dealer.code, isHQ: false })
      .then(rows => { setNotes(rows); setLoaded(true); })
      .catch(e => logRepoRead("notes.list", e));
  }, [dealer.code]);

  useEffect(() => {
    read();
    // โน้ตเป็นงานร่วมกัน — เปิดสองแท็บ/สองเครื่องต้องเห็นตรงกัน
    // ⚠️ ต้องเป็น subscribeNotes ไม่ใช่ subscribeSales (H6):
    //   เดิมฟัง subscribeSales ซึ่งไม่มี customer_notes → (ก) โน้ตจากเครื่องอื่นไม่เห็นจนรีเฟรช
    //   (ข) ลูกค้าเป้าหมาย/ใบเสนอราคาขยับแม้แต่แถวเดียวก็โหลดโน้ตใหม่ทั้งชุดโดยไม่จำเป็น
    return realtime.subscribeNotes(() => read());
  }, [read]);

  const add: UseCustomerNotes["add"] = useCallback(async (n) => {
    const row = await repo.create({
      ...n,
      dealerCode: dealer.code,
      pinned: false,
      author,
      createdAt: APP_NOW_ISO,
      updatedAt: APP_NOW_ISO,
    });
    setNotes(prev => [row, ...prev]);
  }, [dealer.code, author]);

  const update = useCallback(async (n: CustomerNote) => {
    const row = await repo.update({ ...n, updatedAt: APP_NOW_ISO });
    setNotes(prev => prev.map(x => x.id === row.id ? row : x));
  }, []);

  const remove = useCallback(async (id: number) => {
    await repo.remove(id);
    setNotes(prev => prev.filter(x => x.id !== id));
  }, []);

  return { notes, loaded, add, update, remove };
}

/** โน้ตของลูกค้า — มุมมอง HQ (อ่านอย่างเดียว ข้ามสาขาได้ ตาม RLS customer_notes_select: is_hq() or ...)
 *  เดิม HQ ไม่มีทางอ่านตารางนี้เลยแม้ RLS จะอนุญาตไว้แล้ว — ใช้ scope { dealerCode, isHQ:false } เพื่อกรองที่ query
 *  ตรง ๆ (ไม่ใช่ isHQ:true ที่จะดึงทั้งเครือมาโดยไม่จำเป็น เพราะแผงนี้ดูทีละลูกค้า/ทีละสาขาเท่านั้น) */
export function useCustomerNotesForDealer(dealerCode: string): { notes: CustomerNote[]; loaded: boolean } {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!dealerCode) { setNotes([]); setLoaded(true); return; }
    let alive = true;
    setLoaded(false);
    repo.list({ dealerCode, isHQ: false })
      .then(rows => { if (alive) { setNotes(rows); setLoaded(true); } })
      .catch(e => { logRepoRead("notes.list(hq)", e); if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [dealerCode]);

  return { notes, loaded };
}
