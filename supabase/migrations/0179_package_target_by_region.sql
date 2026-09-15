-- ── เป้ายอดขายของแพ็กเกจ แยกตามภูมิภาค (บอสสั่ง 15 ก.ย. 69 "ให้แยกตามภูมิภาค") ─────────────────
--
-- ต่อจาก 0178: เป้าของแพ็กเกจเดิมมีค่าเดียวทั้งประเทศ → เพิ่มเป้าแยก 6 ภาค
--   hq_recruit_settings.config → proposal.packages.<แพ็กเกจ>.targetsByRegion.<ภาค>  (ภาคตาม lib/provinces.ts REGIONS)
--
-- ลำดับการหาเป้าของตัวแทน (ตรงกับ lib/recruitSettings.ts เป้าตามแพ็กเกจ):
--   1) เป้าของแพ็กเกจในภาคของตัวแทน   2) เป้ากลางของแพ็กเกจ (annualTarget · ใช้กับภาคที่ไม่ได้ตั้ง/ทุกภาค)
--   3) ไม่มีทั้งสอง = ใช้เป้าที่กรอกเอง
-- เปลี่ยนภาคของตัวแทน → เป้าเปลี่ยนตามภาคใหม่

create or replace function public.package_annual_target(p text, r text) returns numeric
  language sql stable security definer set search_path = public as $$
  select coalesce(
           case when jsonb_typeof(config #> array['proposal', 'packages', p, 'targetsByRegion', r]) = 'number'
                 and (config #>> array['proposal', 'packages', p, 'targetsByRegion', r])::numeric >= 0
                then (config #>> array['proposal', 'packages', p, 'targetsByRegion', r])::numeric end,
           case when jsonb_typeof(config #> array['proposal', 'packages', p, 'annualTarget']) = 'number'
                 and (config #>> array['proposal', 'packages', p, 'annualTarget'])::numeric >= 0
                then (config #>> array['proposal', 'packages', p, 'annualTarget'])::numeric end)
  from public.hq_recruit_settings
  where id = 1 and p in ('standard', 'exclusive')
$$;
revoke all on function public.package_annual_target(text, text) from public, anon;
grant execute on function public.package_annual_target(text, text) to authenticated;

create or replace function public.dealers_package_target() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  t numeric;
begin
  if new.package is not null then
    t := package_annual_target(new.package, new.region);
    if t is not null then new.revenue_target := t; end if;
  end if;
  return new;
end $$;

-- เปลี่ยนภาคก็ต้องคิดเป้าใหม่ด้วย
drop trigger if exists dealers_package_target on public.dealers;
create trigger dealers_package_target before insert or update of package, revenue_target, region on public.dealers
  for each row execute function public.dealers_package_target();

create or replace function public.hq_recruit_settings_sync_targets() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.dealers d
     set revenue_target = package_annual_target(d.package, d.region)
   where d.package is not null
     and package_annual_target(d.package, d.region) is not null
     and d.revenue_target is distinct from package_annual_target(d.package, d.region);
  return null;
end $$;

-- ฟังก์ชันแบบไม่มีภาค (0178) ไม่มีใครเรียกแล้ว
drop function if exists public.package_annual_target(text);
