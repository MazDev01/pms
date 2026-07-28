-- Benjamin PMS — cron expire-quotations (0066) ปิดใบตามนิยาม "หมดอายุ" ใหม่ (0067)
--
-- 0066 เดิมเช็คเฉพาะ expiry ที่กรอกเอง — ใบส่วนใหญ่ไม่ได้กรอก (ฟอร์มค่าเริ่มต้นว่าง) จึง no-op เกือบทั้งหมด
-- ตอนนี้ 0067 เปลี่ยนนิยามเป็น expiry (ถ้ามี) ไม่งั้น date+validity_days → cron ต้องอัปเดตตาม ให้ตรงกัน
--
-- cron รันข้ามทุกสาขา (ไม่ผ่าน RLS โดยเจตนา — งานเบื้องหลัง ไม่ใช่ RPC ที่ผู้ใช้เรียก) จึงเขียน SQL ตรง ๆ
-- แทนเรียก expire_quotations() ที่เป็น SECURITY INVOKER (ผูก RLS ของผู้เรียก ใช้กับ cron ไม่ได้)
--   ต้อง sync สองก้อนนี้ (SQL ในนี้ + expire_quotations RPC) มือ — คนละ security model แต่ต้องคิดเลขตรงกัน
-- validity default 30 วัน ตรงกับ DEFAULT_HQ_POLICY.quoteValidityDays (mock.ts) — ตัวแปรกลางเดียวที่ยึด
--
-- cron.schedule upsert ตามชื่องาน "expire-quotations" (เดิมจาก 0066) = แทนที่ SQL เดิม รันซ้ำปลอดภัย
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'expire-quotations',
    '0 * * * *',
    $q$
      update public.quotations
         set status = 'expired'
       where status = 'sent_to_client'
         and (
           case
             when expiry is not null and expiry ~ '^\d{4}-\d{2}-\d{2}$' then expiry::date
             when date ~ '^\d{4}-\d{2}-\d{2}' then substring(date,1,10)::date + 30
             else null
           end
         ) < now()::date
    $q$
  );
exception when others then
  raise notice 'ข้าม expire-quotations cron: pg_cron ยังไม่พร้อม (%) — เปิด pg_cron แล้วรันใบนี้ใหม่', sqlerrm;
end $$;
