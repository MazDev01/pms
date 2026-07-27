"use client";

// โครงหน้าโหลดมาตรฐาน (KPI การ์ด + ตาราง) — ใช้เป็น loading.tsx ระดับ segment
// ครอบทุกหน้าลูกในไฟล์เดียว · Next แสดงระหว่างนำทางอัตโนมัติ แทนหน้าว่าง/สปินเนอร์
import { SkeletonCards, SkeletonTable } from "./Skeleton";

export function PageSkeleton({ cards = 4, rows = 7, cols = 5 }: { cards?: number; rows?: number; cols?: number }) {
  return (
    <div className="erp" style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-busy="true" aria-label="กำลังโหลด">
      <SkeletonCards count={cards} />
      <SkeletonTable rows={rows} cols={cols} />
    </div>
  );
}

export default PageSkeleton;
