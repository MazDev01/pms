-- แก้ข้อความตอนปฏิเสธการลบประวัติการต่อรองราคา (ต่อจาก 0148)
--
-- 0148 เขียน `raise exception '...' using message = '...'` ซึ่ง PostgreSQL ไม่ยอม
--   (กำหนดข้อความสองที่พร้อมกัน) ด่านยังกันได้ถูกต้อง แต่ error ที่เด้งกลับไปหาคนใช้
--   กลายเป็น "RAISE option already specified: MESSAGE" ซึ่งอ่านไม่รู้เรื่องเลย
-- เจอตอนทดสอบจริง: ด่านทำงาน (ลบไม่ได้) แต่ข้อความผิด — แก้ให้ขึ้นข้อความไทยตามตั้งใจ
create or replace function public.guard_price_history_append_only() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_array_length(coalesce(new.price_history, '[]'::jsonb))
   < jsonb_array_length(coalesce(old.price_history, '[]'::jsonb)) then
    raise exception using
      errcode = 'check_violation',
      message = 'ลบประวัติการต่อรองราคาย้อนหลังไม่ได้';
  end if;
  return new;
end $$;
