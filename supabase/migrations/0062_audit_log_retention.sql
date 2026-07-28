-- Benjamin PMS — ล้าง audit_log เก่าอัตโนมัติ (retention) กันตารางโตไม่จำกัด
--
-- audit_log เป็น append-only (เขียนอย่างเดียว ไม่มีใครลบ · ดู 0002/0031) → โตไม่จำกัด
-- อ่านมีเพดาน (M8) แต่เขียนไม่มี · นานเข้าเปลืองที่เก็บ + สแกนช้า
--
-- แก้: ตั้งงานอัตโนมัติลบรายการที่เก่ากว่า 2 ปี (at ใช้ now() จริง ไม่ใช่ APP_NOW → retention ตามเวลาจริงได้)
--   หน้าต่างเก็บ 2 ปี = พอสำหรับตรวจสอบย้อนหลัง โดยไม่ให้ตารางบวมไม่จำกัด (ปรับได้ที่ interval ด้านล่าง)
--
-- ⚠️ ต้องมี extension pg_cron (Supabase: Dashboard → Database → Extensions → เปิด pg_cron ก่อน
--    หรือบรรทัด create extension ด้านล่างจะเปิดให้ถ้ามีสิทธิ์) · cron.schedule upsert ตามชื่องาน = รันซ้ำได้

create extension if not exists pg_cron;

select cron.schedule(
  'audit-log-retention',
  '0 3 * * *',                                                    -- ทุกวัน 03:00
  $$ delete from public.audit_log where at < now() - interval '2 years' $$
);
