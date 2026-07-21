// SupabaseAdapter — โครงว่างสำหรับเฟส B (ดู BACKEND-DESIGN.md)
// แต่ละ repository จะ map ตาราง Supabase + ใช้ RLS · ยังไม่ทำในสเต็ปนี้
// ตั้ง NEXT_PUBLIC_DATA_SOURCE=local เพื่อใช้งานตอนนี้
import type { DataAdapter } from "../ports";

function notReady(): never {
  throw new Error(
    "SupabaseAdapter ยังไม่พร้อม (เฟส B) — ตั้ง NEXT_PUBLIC_DATA_SOURCE=local · ดู BACKEND-DESIGN.md",
  );
}

// proxy: เข้าถึง repo/เมธอดใดก็ตาม → โยน error ที่อ่านรู้เรื่อง (กัน import พังตอน build)
export const SupabaseAdapter: DataAdapter = new Proxy({} as DataAdapter, {
  get: () => new Proxy({}, { get: () => notReady }),
});
