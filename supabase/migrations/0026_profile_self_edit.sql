-- Benjamin PMS — โปรไฟล์ผู้ใช้ (ชื่อ/อีเมลติดต่อ/เบอร์/รูป) ย้ายจาก localStorage มาที่ตาราง profiles
--
-- ปัญหาเดิม: เก็บที่ localStorage คีย์ bpms_profile_{dealerCode}
--   • ผูกกับ "สาขา" ไม่ใช่ "คน" → ผู้ใช้หลายคนในสาขาเดียวกันทับโปรไฟล์กันเอง
--   • ล้างเบราว์เซอร์/ย้ายเครื่อง = ชื่อกับรูปหาย กลับไปแสดงอีเมลแทน
--
-- profiles มี name/avatar อยู่แล้ว ขาดแค่ phone และอีเมลติดต่อ
-- (auth.users.email = อีเมลที่ใช้ล็อกอิน · contact_email = อีเมลที่อยากให้ลูกค้าติดต่อ คนละตัว)
alter table profiles add column if not exists phone         text not null default '';
alter table profiles add column if not exists contact_email text not null default '';

-- ── ให้ผู้ใช้แก้โปรไฟล์ "ของตัวเอง" ได้ ──
-- เดิมนโยบายเขียนอนุญาตเฉพาะ SUPER_ADMIN → คนทั่วไปแก้ชื่อ/รูปตัวเองไม่ได้เลย
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using ( id = auth.uid() ) with check ( id = auth.uid() );

-- ⚠️ RLS จำกัด "แถว" ได้ แต่จำกัด "คอลัมน์" ไม่ได้ — ถ้าปล่อยแค่นโยบายข้างบน
--    ผู้ใช้จะยกระดับตัวเองเป็น SUPER_ADMIN หรือย้ายตัวเองไปสาขาอื่นได้ด้วยการยิง API ตรง
--    จึงต้องมี trigger กันไม่ให้ role/dealer_code/status เปลี่ยน เว้นแต่ผู้แก้เป็น SUPER_ADMIN
create or replace function public.guard_profile_privilege()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth_role() = 'SUPER_ADMIN' then
    return new;   -- ผู้ดูแลระบบจัดการสิทธิ์ผู้อื่นได้ตามปกติ
  end if;
  if new.role        is distinct from old.role
     or new.dealer_code is distinct from old.dealer_code
     or new.status      is distinct from old.status then
    raise exception 'แก้บทบาท/สาขา/สถานะของตัวเองไม่ได้';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_privilege on profiles;
create trigger trg_guard_profile_privilege before update on profiles
  for each row execute function public.guard_profile_privilege();
