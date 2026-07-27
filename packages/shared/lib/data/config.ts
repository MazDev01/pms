// เลือกแหล่งข้อมูลด้วย ENV — สลับ local ↔ supabase โดยไม่ต้องแก้โค้ดหน้า
//   .env.local → NEXT_PUBLIC_DATA_SOURCE = local | supabase
export type DataSource = "local" | "supabase";

export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "local";

// ตั้ง supabase แต่ขาด URL/anon key = แอปจะเชื่อม DB ไม่ได้ · เดิม fallback เป็น "" เงียบ ๆ
// แล้วไป error ตอน query แรก — เตือนตั้งแต่โหลดโมดูลให้เห็นชัด (ไม่ throw: กันพัง build/หน้าที่ไม่แตะ DB)
if (
  DATA_SOURCE === "supabase" &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  console.error(
    "[config] NEXT_PUBLIC_DATA_SOURCE=supabase แต่ขาด NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY — ตรวจ .env.local (แอปจะเชื่อมฐานข้อมูลไม่ได้)",
  );
}
