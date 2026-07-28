import type { SupabaseClient } from "@supabase/supabase-js";

// Rate limit แบบ distributed (ข้ามทุก instance) ผ่าน RPC check_rate_limit (ตาราง rate_limits · migration 0065)
//
// เดิมเป็น in-memory ต่อ instance → บน Vercel serverless หลาย instance กันได้ไม่ทั่ว
// ตอนนี้ตัวนับอยู่ที่ DB (ทุก instance เห็นร่วมกัน · ตรวจ+เพิ่มแบบ atomic ที่ RPC)
//
// fail-open: ถ้า limiter ล้มเอง (RPC หาย/DB มีปัญหา) → ปล่อยผ่าน ไม่บล็อกงานหลัก
//   (ยอมให้เกินโควตาชั่วคราว ดีกว่าปิดบริการเพราะ limiter พัง · ผู้เรียกผ่าน JWT+บทบาทอยู่แล้ว)

/** คืน true = ผ่าน (ยังไม่เกินโควตา) · false = เกิน (ควรตอบ 429)
 *  admin = client ที่ถือ service_role (route admin) · key = ตัวระบุผู้เรียก
 *  max ครั้ง ต่อ windowSeconds วินาที */
export async function checkRateLimit(
  admin: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) { console.warn("[rateLimit] RPC error — fail-open", error.message); return true; }
    return data !== false;
  } catch (e) {
    console.warn("[rateLimit] fail-open", e);
    return true;
  }
}
