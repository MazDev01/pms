// เช็กสุขภาพของแอปสำนักงานใหญ่ — ให้ตัวเฝ้าระวัง/ตัวจัดการเซิร์ฟเวอร์ยิงถามเป็นระยะ
// ตรรกะอยู่ที่ packages/shared/lib/healthCheck.ts (ใช้ร่วมกับแอปตัวแทน แก้ที่เดียวมีผลทั้งสองแอป)
import { healthHandler } from "@pms/shared/lib/healthCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // ห้ามแคช — ต้องเช็กสดทุกครั้งที่ถูกถาม

// แอปสำนักงานใหญ่ต้องมี service_role ด้วย (ใช้จัดการตัวแทน/ผู้ใช้ที่ฝั่งเซิร์ฟเวอร์)
// และ DEALER_SECRET_KEY สำหรับถอดรหัสผ่านตัวแทนที่เก็บไว้
export const GET = healthHandler("hq", [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEALER_SECRET_KEY",
]);
