import { createClient } from "@supabase/supabase-js";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { SUPABASE_MODE } from "./supabaseEnv";
import { teardownBaseline, restoreAlertsIfPending } from "./global-setup";

export default async function globalTeardown() {
  if (!SUPABASE_MODE || !ADMIN_SUPABASE_URL || !ADMIN_SERVICE_ROLE_KEY) return;
  const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY);
  await teardownBaseline(admin);
  await restoreAlertsIfPending(admin); // คืน hq_notif_rules.alerts เป็นค่าเดิมก่อน seed
  console.log("[global-teardown] ลบข้อมูลตั้งต้น (ZZTEST-BASE) + คืนค่า alerts เดิมแล้ว");
}
