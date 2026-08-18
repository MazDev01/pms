// เลือกแหล่งข้อมูลด้วย ENV — สลับ local ↔ supabase โดยไม่ต้องแก้โค้ดหน้า
//   .env.local → NEXT_PUBLIC_DATA_SOURCE = local | supabase
//   "api" = คุยผ่าน backend ของเราเอง (ระยะ 1 ของแผนแยก backend · 17 ส.ค. 69)
//           ย้ายครบ 17/18 กลุ่มแล้ว เหลือ realtime ที่ยังเป็น no-op (ของจริงอยู่ที่ระยะ 3)
//           สลับได้โดยไม่ต้องแตะโค้ดหน้าเว็บเลย (ดู docs/BACKEND-MIGRATION.md)
export type DataSource = "local" | "supabase" | "api";

// ── "มี backend จริงไหม" ≠ "ใช้อะแดปเตอร์ตัวไหน" ────────────────────────────────
// เดิมโค้ดหลายที่เช็ค DATA_SOURCE === "supabase" เพื่อถามว่า "มีระบบยืนยันตัวตนจริงไหม"
// ซึ่งถูกตอนมีแค่ 2 โหมด แต่พอเพิ่มโหมด api เข้ามา คำถามสองข้อนี้แยกจากกันแล้ว:
//   • local = เดโม ไม่มีบัญชีจริง ไม่มีสิทธิ์จริง
//   • supabase / api = ของจริงทั้งคู่ (ต่างกันแค่คำขอข้อมูลเดินทางไหน)
// เจอตอนทดสอบระยะ 1: เปิดโหมด api แล้วล็อกอินไม่ได้ เพราะทุกด่านตกไปใช้ทางเดโม
export const REAL_BACKEND = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase"
  || process.env.NEXT_PUBLIC_DATA_SOURCE === "api";

export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase"
  : process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api"
  : "local";

// ตั้งโหมดของจริงแต่ขาด URL/anon key = แอปจะเชื่อม DB ไม่ได้ · เดิม fallback เป็น "" เงียบ ๆ
// แล้วไป error ตอน query แรก — เตือนตั้งแต่โหลดโมดูลให้เห็นชัด (ไม่ throw: กันพัง build/หน้าที่ไม่แตะ DB)
// โหมด api ก็ต้องมี — ระบบล็อกอินยังเป็นของ Supabase และ backend ส่งใบผ่านนั้นต่อให้ DB
if (REAL_BACKEND && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.error(
    `[config] NEXT_PUBLIC_DATA_SOURCE=${DATA_SOURCE} แต่ขาด NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY — ตรวจ .env.local (แอปจะเชื่อมฐานข้อมูลไม่ได้)`,
  );
}
