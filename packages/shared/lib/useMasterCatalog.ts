"use client";

import { solutionProducts, type SolutionProduct } from "./mock";
import { catalog as catalogRepo } from "./data";
import { useRepoValue } from "./useRepoState";

// แคตตาล็อกแม่แบบ/ราคากลาง "แหล่งเดียว" — HQ แก้ที่ /hq/master → ทุก dropdown/หน้า dealer เห็นชุดเดียวกัน
// เริ่มด้วย mock (SSR-safe) แล้วโหลดจาก repository ตอน mount (local: localStorage · supabase: DB)
export function useMasterCatalog(): SolutionProduct[] {
  return useRepoValue<SolutionProduct[]>(() => catalogRepo.list(), solutionProducts);
}
