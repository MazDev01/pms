"use client";

import { useState, useEffect } from "react";
import { solutionProducts, loadMasterCatalog, type SolutionProduct } from "./mock";

// แคตตาล็อกแม่แบบ/ราคากลาง "แหล่งเดียว" — HQ แก้ที่ /hq/master → ทุก dropdown/หน้า dealer เห็นชุดเดียวกัน
// เริ่มด้วย mock (SSR-safe) แล้ว sync เป็นชุดที่ persist ไว้ตอน mount
export function useMasterCatalog(): SolutionProduct[] {
  const [catalog, setCatalog] = useState<SolutionProduct[]>(solutionProducts);
  useEffect(() => { setCatalog(loadMasterCatalog()); }, []);
  return catalog;
}
