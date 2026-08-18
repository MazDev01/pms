import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { REAL_BACKEND } from "./supabaseEnv";
import { teardownBaseline, restoreAlertsIfPending } from "./global-setup";

// ── กวาดข้อมูลทดสอบ "ครั้งสุดท้าย" หลังทุกอย่างจบจริง ─────────────────────────────
//
// ทำไมต้องมี ทั้งที่แต่ละสเปกมี cleanup ของตัวเองแล้ว:
//   cleanup ของสเปกทำงานตอน afterAll ซึ่งอาจยังมีคำสั่งค้างอยู่ในสาย — โดยเฉพาะ "ปิดการขาย"
//   ที่เทสต์กดแล้วจบเทสต์เลย · RPC ฝั่ง DB ไปสร้างลูกค้าเสร็จ *หลัง* cleanup ผ่านไปแล้ว
//   ลูกค้ารายนั้นจึงค้างในฐานข้อมูลจริงตลอดไป (ตรวจพบ 12 รายค้างสะสมข้ามรอบ · ชุดตรวจรับ 6 ส.ค. 69)
//   และไปโผล่ในรายงานว่าเป็น "ลูกค้าที่มียอดสะสมแต่ไม่มีใบเสนอราคา" ซึ่งดูเหมือนข้อมูลเพี้ยน
//
// ตัวกวาดนี้รันตอนจบทั้งชุด ไม่มีอะไรค้างในสายแล้ว จึงเก็บของตกได้หมดจริง
// เงื่อนไขความปลอดภัย: แตะเฉพาะแถวที่ชื่อมีป้าย ZZTEST/ZZLOAD เท่านั้น — ข้อมูลจริงไม่มีป้ายนี้
const TEST_MARKS = ["ZZTEST", "ZZLOAD"];

async function sweep(admin: SupabaseClient): Promise<string> {
  const removed: string[] = [];
  const del = async (table: string, column: string, mark: string) => {
    const { data, error } = await admin.from(table).delete().like(column, `%${mark}%`).select("id");
    if (error) { removed.push(`${table}:อ่านไม่ได้(${error.code ?? "?"})`); return; }
    if (data?.length) removed.push(`${table} ${data.length}`);
  };
  for (const mark of TEST_MARKS) {
    // ลำดับสำคัญ: ลบลูก (ที่อ้างถึงลูกค้า) ก่อนเสมอ ไม่งั้น FK จะกันการลบแม่ไว้
    await del("customer_notes", "title", mark);
    await del("files", "name", mark);
    await del("quotations", "customer", mark);
    await del("quotations", "id", mark);
    await del("appointments", "company", mark);
    await del("leads", "company", mark);
    await del("leads", "id", mark);
    await del("customers", "company", mark);
  }
  return removed.join(" · ");
}

export default async function globalTeardown() {
  if (!REAL_BACKEND || !ADMIN_SUPABASE_URL || !ADMIN_SERVICE_ROLE_KEY) return;
  const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY);
  await teardownBaseline(admin);
  await restoreAlertsIfPending(admin); // คืน hq_notif_rules.alerts เป็นค่าเดิมก่อน seed
  const leftovers = await sweep(admin);
  console.log(`[global-teardown] ลบข้อมูลตั้งต้น (ZZTEST-BASE) + คืนค่า alerts เดิมแล้ว${leftovers ? ` · เก็บของตกค้าง: ${leftovers}` : ""}`);
}
