-- ── เป้ายอดขายรายปีของตัวแทน เชื่อมกับแพ็กเกจ Standard / Exclusive (บอสสั่ง 15 ก.ย. 69) ─────────────
--
-- ที่มา: ไฟล์ตัวแทนของเบนจามินไม่มีตัวเลขเป้า มีแค่ว่าแต่ละรายสนใจแพ็กเกจไหน (Standard / Exclusive)
--   บอสเลือกให้เป้ามาจากแพ็กเกจ — ตัวเลขอยู่ที่ ตั้งค่า › หาตัวแทน › ค่าตั้งต้นใบเสนอแพ็กเกจ › "เป้ายอดซื้อต่อปี"
--   (hq_recruit_settings.config → proposal.packages.<แพ็กเกจ>.annualTarget · 0176)
--
-- กติกา:
--   • ตัวแทนมีแพ็กเกจ + แพ็กเกจนั้นตั้งเป้าไว้  → revenue_target = เป้าของแพ็กเกจเสมอ (กรอกทับไม่ได้)
--   • ไม่มีแพ็กเกจ หรือแพ็กเกจยังไม่ตั้งเป้า       → ใช้เป้าที่กรอกเอง/จากใบเสนอเหมือนเดิม (ไม่เดาตัวเลข)
--   • แก้เป้าของแพ็กเกจที่หน้าตั้งค่า              → ตัวแทนทุกรายในแพ็กเกจนั้นเปลี่ยนตามทันที
--   • ล้างเป้าของแพ็กเกจ (เว้นว่าง)               → ไม่ล้างเป้าของตัวแทนทิ้ง (คงค่าล่าสุดไว้ แก้เองต่อได้)

alter table public.dealers add column if not exists package text;
alter table public.dealers drop constraint if exists dealers_package_check;
alter table public.dealers add constraint dealers_package_check check (package is null or package in ('standard', 'exclusive'));
comment on column public.dealers.package is 'แพ็กเกจตัวแทน (standard/exclusive) — เป้ายอดขายรายปีตามแพ็กเกจที่ตั้งไว้ใน hq_recruit_settings';

-- เป้าต่อปีของแพ็กเกจจากหน้าตั้งค่า · ไม่ได้ตั้ง/ไม่ใช่ตัวเลข/ติดลบ = null
create or replace function public.package_annual_target(p text) returns numeric
  language sql stable security definer set search_path = public as $$
  select case
           when p in ('standard', 'exclusive')
            and jsonb_typeof(config #> array['proposal', 'packages', p, 'annualTarget']) = 'number'
            and (config #>> array['proposal', 'packages', p, 'annualTarget'])::numeric >= 0
           then (config #>> array['proposal', 'packages', p, 'annualTarget'])::numeric
         end
  from public.hq_recruit_settings where id = 1
$$;
revoke all on function public.package_annual_target(text) from public, anon;
grant execute on function public.package_annual_target(text) to authenticated;

-- ตัวแทนที่มีแพ็กเกจ: เป้าตามแพ็กเกจเสมอ — ทุกทางที่เขียน (หน้าตัวแทน · สร้างจากลูกค้าเป้าหมาย · ยิงตรง)
create or replace function public.dealers_package_target() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  t numeric;
begin
  if new.package is not null then
    t := package_annual_target(new.package);
    if t is not null then new.revenue_target := t; end if;
  end if;
  return new;
end $$;

drop trigger if exists dealers_package_target on public.dealers;
create trigger dealers_package_target before insert or update of package, revenue_target on public.dealers
  for each row execute function public.dealers_package_target();

-- แก้เป้าของแพ็กเกจที่หน้าตั้งค่า → ตัวแทนในแพ็กเกจนั้นเปลี่ยนตาม
create or replace function public.hq_recruit_settings_sync_targets() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.dealers d
     set revenue_target = package_annual_target(d.package)
   where d.package is not null
     and package_annual_target(d.package) is not null
     and d.revenue_target is distinct from package_annual_target(d.package);
  return null;
end $$;

drop trigger if exists hq_recruit_settings_sync_targets on public.hq_recruit_settings;
create trigger hq_recruit_settings_sync_targets after insert or update on public.hq_recruit_settings
  for each row execute function public.hq_recruit_settings_sync_targets();

-- ทะเบียนตัวแทน (อ่าน) — เพิ่มคอลัมน์แพ็กเกจต่อท้าย (create or replace view เพิ่มได้เฉพาะท้ายสุด)
create or replace view public.dealers_directory as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target,
  package
from public.dealers;
-- create or replace view รีเซ็ต ACL — ต้องถอน anon/PUBLIC ซ้ำทุกครั้ง (ดู 0108/0109)
revoke all on public.dealers_directory from public, anon;
grant select on public.dealers_directory to authenticated;

-- บันทึกการแก้ไขตัวแทน — รับแพ็กเกจเพิ่ม · ไม่ส่งคีย์ package มา = คงค่าเดิม (ผู้เรียกเก่าไม่ล้างแพ็กเกจทิ้ง)
create or replace function public.save_dealers(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  touched integer := 0;
  n integer;
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to write dealers';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    update dealers set
      name           = r->>'name',
      province       = r->>'province',
      region         = r->>'region',
      status         = coalesce(r->>'status', 'active')::dealer_status,
      revenue_target = greatest(coalesce(nullif(r->>'revenue_target', '')::numeric, 0), 0),
      package        = case when r ? 'package' then nullif(r->>'package', '') else package end
    where code = r->>'code';
    get diagnostics n = row_count;
    touched := touched + n;
  end loop;

  return touched;
end $$;

revoke all    on function public.save_dealers(jsonb) from public, anon;
grant  execute on function public.save_dealers(jsonb) to   authenticated;

-- ตัวแทนที่สร้างจากลูกค้าเป้าหมาย: แพ็กเกจ = ใบหลัก (ตอบรับล่าสุด ไม่มีใช้ส่งแล้วล่าสุด) — ข้อมูลที่มีอยู่แล้วในระบบ
update public.dealers d
   set package = pp.package
  from (
    select distinct on (p.dealer_code) p.dealer_code, pr.package
      from public.dealer_prospects p
      join public.dealer_package_proposals pr on pr.prospect_id = p.id
     where p.dealer_code is not null and pr.status in ('accepted', 'sent')
     order by p.dealer_code, (pr.status = 'accepted') desc, pr.id desc
  ) pp
 where d.code = pp.dealer_code and d.package is null;
