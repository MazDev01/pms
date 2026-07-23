"use client";

import { useEffect, useState } from "react";
import { logRepoRead } from "./repoLog";
import { MASTER_CATALOG_EVENT, type SolutionProduct } from "./mock";
import { catalog as catalogRepo, realtime } from "./data";

// แคตตาล็อกแม่แบบ/ราคากลาง "แหล่งเดียว" — HQ แก้ที่ /hq/master → ทุก dropdown/หน้าแม่แบบเห็นชุดเดียวกัน
// เริ่มด้วย mock (SSR-safe) แล้วโหลดจาก repository ตอน mount + ติดตามการแก้เพื่ออัปเดตตามทันที:
//   • supabase → Realtime (postgres_changes บน master_catalog) = ข้ามแอป/ข้ามเครื่องได้จริง
//   • local    → event ตอนกดบันทึก + storage event = ได้เฉพาะ origin เดียวกัน
//     ⚠️ โหมด local ตัวแทน(:3001) กับ HQ(:3002) คนละ origin → localStorage แยกกัน จึงไม่เห็นกัน
//        ถ้าต้องการให้ HQ แก้แล้วตัวแทนเปลี่ยนตาม ต้องตั้ง NEXT_PUBLIC_DATA_SOURCE=supabase
export function useMasterCatalog(): SolutionProduct[] {
  // เริ่มว่างเสมอ — เดิมตั้งต้นด้วยชุดตัวอย่าง ทำให้เห็นแม่แบบปลอมกะพริบก่อนของจริงมา
  // และถ้า query ล้มเหลว จะค้างอยู่กับชุดตัวอย่างตลอด (ตกไปถึง dropdown "แม่แบบ" ทุกหน้า)
  const [catalog, setCatalog] = useState<SolutionProduct[]>([]);

  useEffect(() => {
    let alive = true;
    // แสดงตามที่ repo คืนมาจริง (ถ้าแคตตาล็อกใน DB ว่าง = เห็นว่าง ไม่เอา mock มาทับให้เข้าใจผิด)
    const read = () => {
      catalogRepo.list()
        .then((rows) => { if (alive) setCatalog(rows); })
        .catch((e) => logRepoRead("catalog.list", e));
    };
    read();

    const unsubRealtime = realtime.subscribeCatalog(read); // supabase: ข้ามแอป · local: no-op
    window.addEventListener(MASTER_CATALOG_EVENT, read);   // local: HQ กดบันทึกในแอปเดียวกัน
    window.addEventListener("storage", read);              // local: อีกแท็บของ origin เดียวกัน
    return () => {
      alive = false;
      unsubRealtime();
      window.removeEventListener(MASTER_CATALOG_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return catalog;
}
