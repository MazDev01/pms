-- Benjamin PMS — cron ตัดใบหมดอายุ อ่าน "อายุใบ" จริงจากนโยบาย HQ แทนเลข 30 ตายตัว
-- (จากผลตรวจสอบตรรกะระบบ 31 ก.ค. 69)
--
-- เดิม: cron job "expire-quotations" (0066/0068) ฝังเลข "+ 30" ตรงๆ ใน SQL ขณะที่เส้นทางโต้ตอบจริง
--   (SalesContext.tsx เรียก expire_quotations RPC) อ่านค่า hq_policy.quote_validity_days ที่ตั้งไว้เสมอ
--   ทั้งสองจุดควรนิยาม "หมดอายุ" ตรงกันเป๊ะตามที่ 0067 ตั้งใจไว้ แต่ cron ไม่เคย sync ค่าจริงจาก DB
--   วันนี้บังเอิญตรงกันเพราะ default ยังไม่เคยถูกเปลี่ยน (การ์ดแก้ค่านี้ถูกถอดออกจากหน้า HQ settings แล้ว
--   17 ก.ค. 69 — เปลี่ยนได้แค่แก้ตรง DB) แต่ถ้าเปลี่ยนวันหน้า สองจุดนี้จะไม่ตรงกันทันที
--
-- แก้ให้ cron อ่านค่าจาก hq_policy (id=1 singleton) สดทุกครั้งที่รัน แทนเลขฝัง — เหมือนที่ RPC ทำ

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
             when date ~ '^\d{4}-\d{2}-\d{2}' then
               substring(date,1,10)::date
               + coalesce((select quote_validity_days from public.hq_policy where id = 1), 30)
             else null
           end
         ) < now()::date
    $q$
  );
exception when others then
  raise notice 'ข้าม expire-quotations cron: pg_cron ยังไม่พร้อม (%) — เปิด pg_cron แล้วรันใบนี้ใหม่', sqlerrm;
end $$;
