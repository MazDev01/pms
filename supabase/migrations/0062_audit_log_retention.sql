-- Benjamin PMS — ล้าง audit_log เก่าอัตโนมัติ (retention) กันตารางโตไม่จำกัด
--
-- audit_log เป็น append-only (เขียนอย่างเดียว ไม่มีใครลบ · ดู 0002/0031) → โตไม่จำกัด
-- อ่านมีเพดาน (M8) แต่เขียนไม่มี · นานเข้าเปลืองที่เก็บ + สแกนช้า
--
-- แก้: ตั้งงานอัตโนมัติลบรายการที่เก่ากว่า 2 ปี (at ใช้ now() จริง ไม่ใช่ APP_NOW → retention ตามเวลาจริงได้)
--   หน้าต่างเก็บ 2 ปี = พอสำหรับตรวจสอบย้อนหลัง โดยไม่ให้ตารางบวมไม่จำกัด (ปรับได้ที่ interval ด้านล่าง)
--
-- ทนทานต่อ pg_cron: ถ้า extension ยังเปิดไม่ได้ (สิทธิ์/ยังไม่เปิดใน Dashboard) → ข้ามแบบ no-op
--   ไม่ทำให้ migration ถัดไปพัง · เปิด pg_cron (Dashboard → Database → Extensions) แล้วรันใบนี้ใหม่ได้
--   (cron.schedule upsert ตามชื่องาน = รันซ้ำปลอดภัย)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'audit-log-retention',
    '0 3 * * *',                                                  -- ทุกวัน 03:00
    $q$ delete from public.audit_log where at < now() - interval '2 years' $q$
  );
exception when others then
  raise notice 'ข้าม audit-log retention: pg_cron ยังไม่พร้อม (%) — เปิด pg_cron แล้วรันใบนี้ใหม่', sqlerrm;
end $$;
