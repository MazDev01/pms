// ── backend ของเราเอง · เส้นทาง /api/v1 ─────────────────────────────────────────
//
// ระยะ 0 ของแผนแยก backend (14 ส.ค. 69) — ใบนี้เป็น "เส้นทางตัวอย่าง" ที่พิสูจน์ว่าโครงเดินได้
// ยังไม่มีของจริงสักเส้น (ดู docs/BACKEND-MIGRATION.md)
//
// ทำไม handler อยู่ในแพ็กเกจกลาง ไม่ได้อยู่ในแอป:
//   ระบบมี 2 แอป (สำนักงานใหญ่ :3002 · ตัวแทน :3001) ทั้งคู่ต้องมี backend ของตัวเอง
//   ถ้าเขียนแยกในแต่ละแอป = โค้ดเดียวกันสองชุด แก้ที่เดียวลืมอีกที่ (บทเรียนซ้ำ ๆ ในโปรเจกต์นี้)
//   จึงเขียนที่นี่ที่เดียว แล้วให้ไฟล์ route ของแต่ละแอปเป็นแค่บรรทัด re-export
//
//   apps/<app>/app/api/v1/ping/route.ts  →  export { GET } from "@pms/shared/server/v1/ping";
//
// ทำไมไม่แยกเป็นเซิร์ฟเวอร์ต่างหาก:
//   อยู่ในแอปเดียวกัน = ไม่มีเรื่อง CORS · ใบผ่านเดินทางไปกับคำขอเอง · ใช้ deploy เดิม
//   ไม่ต้องจ่ายเซิร์ฟเวอร์เพิ่ม และย้อนกลับง่ายถ้าแผนนี้ไปต่อไม่ไหว
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** ตอบว่า backend ตัวนี้มีชีวิตอยู่ + ตอนนี้ย้ายอะไรมาแล้วบ้าง */
export async function GET() {
  const { MIGRATED } = await import("@pms/shared/lib/data/http/HttpAdapter");
  return NextResponse.json({
    ok: true,
    api: "v1",
    phase: 0,
    migrated: MIGRATED,
    note: "ระยะ 0 — โครงว่าง ยังไม่มีกลุ่มงานไหนย้ายมา",
  }, { headers: { "Cache-Control": "no-store" } });
}
