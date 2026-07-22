-- Benjamin PMS — แก้ access-token hook ให้อ่าน profiles ได้แน่นอน
-- ปัญหา: hook รันในสิทธิ์ supabase_auth_admin ที่อ่าน public.profiles ไม่ได้ → login 500
-- แก้: ทำเป็น SECURITY DEFINER (รันในสิทธิ์ owner ของ function = ข้าม RLS/grant) + กัน null
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  p record;
begin
  select role, dealer_code into p
  from public.profiles
  where id = (event ->> 'user_id')::uuid;
  if found then
    claims := jsonb_set(claims, '{user_role}',   to_jsonb(p.role::text));
    claims := jsonb_set(claims, '{dealer_code}', to_jsonb(coalesce(p.dealer_code, '')));
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
