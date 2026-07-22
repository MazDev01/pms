-- Benjamin PMS — ทำให้ใบเสนอราคาหมดอายุได้จริง (H5)
--
-- ปัญหา: สถานะ 'expired' มีใน enum และหน้าจอแสดงได้ แต่ "ไม่มีอะไรตั้งค่าให้เลย"
--        ใบที่ส่งไปแล้วและเลยวันหมดอายุ ยังค้างเป็น 'sent_to_client' ตลอดไป
--
-- ทำไมรับ p_as_of แทนใช้ now():
--   ทั้งระบบยังตรึง "วันนี้" ไว้ที่ APP_NOW (30 มิ.ย. 2569) — ตัวกรอง/วันที่/รายงานอิงค่านี้
--   ถ้าใช้ now() จริง ใบจะหมดอายุไม่ตรงกับสิ่งที่ผู้ใช้เห็นบนจอ
--   ให้แอปส่ง "วันนี้ของระบบ" เข้ามา → ตรงกันเสมอ และเมื่อเลิกตรึงเวลาแล้วก็ยังใช้ได้
--
-- ไม่ใช้ SECURITY DEFINER โดยตั้งใจ → รันด้วยสิทธิ์ผู้เรียก = RLS บังคับให้แต่ละสาขา
-- ปิดได้เฉพาะใบของตัวเอง (HQ เขียนงานขายไม่ได้ จึงได้ 0 แถว)

create or replace function public.expire_quotations(p_as_of date)
returns integer
language plpgsql
as $$
declare n integer;
begin
  update quotations
     set status = 'expired'
   where status = 'sent_to_client'
     and expiry is not null
     and expiry ~ '^\d{4}-\d{2}-\d{2}$'   -- กันค่าว่าง/รูปแบบเพี้ยนทำ cast ล้ม
     and expiry::date < p_as_of;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.expire_quotations(date) from anon;
grant   execute on function public.expire_quotations(date) to authenticated;
