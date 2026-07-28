-- Benjamin PMS — ปิดใบเสนอราคาที่เลยกำหนดโดยอัตโนมัติทุกชั่วโมง (cron)
--
-- เดิม: expire_quotations(p_as_of) มีอยู่ (0019) แต่ต้องให้ "ผู้ใช้เปิดแอป" เป็นคนเรียก
--   ถ้าไม่มีใครเปิดหน้า ใบที่เลยวันหมดอายุก็ค้างเป็น 'sent_to_client' ตลอดไป
--   และตอนนี้เลิกตรึงเวลาแล้ว (แหล่งข้อมูล supabase ใช้เวลาจริง) → ต้องมีคนปิดให้ตรงปฏิทินจริง
--
-- แก้: ตั้ง cron รันทุกชั่วโมง ปิดใบที่ expiry < วันนี้จริง
--   รันจากงานเบื้องหลัง (เจ้าของงาน cron = สิทธิ์ระบบ) → ไม่ติด RLS → ปิดได้ทุกสาขาทั้งเครือ
--   จึงเขียน UPDATE ตรง ๆ (ไม่เรียก expire_quotations ที่เป็น RLS-scoped ผูกกับสาขาผู้เรียก)
--   เงื่อนไขตรงกับ 0019 เป๊ะ: เฉพาะ 'sent_to_client' + expiry รูปแบบ YYYY-MM-DD + เลยกำหนด
--
-- ทนทานต่อ pg_cron: ถ้า extension ยังเปิดไม่ได้ → ข้ามแบบ no-op ไม่ทำให้ migration ถัดไปพัง
--   เปิด pg_cron (Dashboard → Database → Extensions) แล้วรันใบนี้ใหม่ได้ (schedule upsert ตามชื่องาน = รันซ้ำปลอดภัย)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'expire-quotations',
    '0 * * * *',                                                   -- ทุกชั่วโมง (นาทีที่ 0)
    $q$
      update public.quotations
         set status = 'expired'
       where status = 'sent_to_client'
         and expiry is not null
         and expiry ~ '^\d{4}-\d{2}-\d{2}$'
         and expiry::date < now()::date
    $q$
  );
exception when others then
  raise notice 'ข้าม expire-quotations cron: pg_cron ยังไม่พร้อม (%) — เปิด pg_cron แล้วรันใบนี้ใหม่', sqlerrm;
end $$;
