// เลือกแหล่งข้อมูลด้วย ENV — สลับ local ↔ supabase โดยไม่ต้องแก้โค้ดหน้า
//   .env.local → NEXT_PUBLIC_DATA_SOURCE = local | supabase
export type DataSource = "local" | "supabase";

export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "local";
