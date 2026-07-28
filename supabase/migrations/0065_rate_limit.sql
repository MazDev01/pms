-- Benjamin PMS — rate limit แบบ distributed (ข้ามทุก instance) ด้วยตาราง + RPC ของ Supabase
--
-- เดิม rateLimit.ts เป็น in-memory ต่อ instance → บน Vercel serverless หลาย instance กันได้ไม่ทั่ว
-- แก้: เก็บตัวนับที่ DB (ทุก instance เห็นร่วมกัน) · ตรวจ+เพิ่มแบบ atomic ใน RPC (FOR UPDATE ล็อกแถว)
--   ใช้ now() จริง (rate-limit อิงความถี่คำขอจริง ไม่เกี่ยว APP_NOW ที่ตรึงไว้)

create table if not exists rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);
-- เข้าถึงได้เฉพาะผ่าน RPC (security definer) / service_role — ไม่มี policy ให้ผู้ใช้ทั่วไป
alter table rate_limits enable row level security;

-- คืน true = ผ่าน (ยังไม่เกินโควตา) · false = เกิน (ควรตอบ 429)
--   p_key = ตัวระบุผู้เรียก · p_max ครั้ง ต่อ p_window_seconds วินาที (sliding แบบ fixed-window reset)
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rec rate_limits;
begin
  insert into rate_limits(key, window_start, count)
    values (p_key, now(), 0)
    on conflict (key) do nothing;

  select * into rec from rate_limits where key = p_key for update; -- ล็อกกันแข่ง

  if rec.window_start < now() - make_interval(secs => p_window_seconds) then
    update rate_limits set window_start = now(), count = 1 where key = p_key; -- หน้าต่างใหม่
    return true;
  end if;

  if rec.count >= p_max then
    return false; -- เกินโควตาในหน้าต่างนี้
  end if;

  update rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;

-- เรียกได้เฉพาะ service_role (route admin ใช้ service_role อยู่แล้ว) — ไม่เปิดให้ anon/authenticated
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, integer, integer) to service_role;
