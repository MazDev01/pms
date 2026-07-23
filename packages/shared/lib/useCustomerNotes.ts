"use client";

// โน้ตของลูกค้า — เดิมไม่มีที่เก็บจริงเลย มีแต่ชุดตัวอย่างใน mock.ts
// โหมด supabase จึงต้องปิดแท็บโน้ตไว้เฉย ๆ (ผู้ใช้จดอะไรไม่ได้)
// ตอนนี้เก็บที่ตาราง customer_notes ผูกกับสาขา (RLS: สาขาเห็น/แก้ของตัวเอง · HQ อ่านได้)
import { useCallback, useEffect, useState } from "react";
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
      .catch(e => console.error("[notes.list]", e));
  }, [dealer.code]);

  useEffect(() => {
    read();
    // โน้ตเป็นงานร่วมกัน — เปิดสองแท็บ/สองเครื่องต้องเห็นตรงกัน
    return realtime.subscribeSales(() => read());
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
