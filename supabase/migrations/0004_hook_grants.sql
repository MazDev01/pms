-- Benjamin PMS — ให้ access-token hook อ่านตาราง profiles ได้
-- hook (custom_access_token_hook) รันในสิทธิ์ supabase_auth_admin
-- ถ้าไม่ grant + ไม่มี RLS policy สำหรับ role นี้ → function error → login พังทั้งระบบ
-- (ตามคู่มือ Supabase: Custom Access Token Hook)

grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- RLS: อนุญาต supabase_auth_admin อ่าน profiles ตอน generate JWT
drop policy if exists profiles_auth_admin_read on public.profiles;
create policy profiles_auth_admin_read on public.profiles
  as permissive for select to supabase_auth_admin
  using ( true );
