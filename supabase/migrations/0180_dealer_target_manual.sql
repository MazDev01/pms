-- ── เป้ายอดขายของตัวแทน: ตามแพ็กเกจ หรือกำหนดเองรายตัวแทน (บอสสั่ง 15 ก.ย. 69 "ให้สามารถแก้เองหรือแก้ในตั้งค่าก็ได้") ──
--
-- ต่อจาก 0178/0179 ซึ่งบังคับให้ตัวแทนที่มีแพ็กเกจใช้เป้าของแพ็กเกจเสมอ (กรอกทับไม่ได้)
-- เพิ่มสวิตช์ต่อตัวแทน dealers.target_manual:
--   • false (ค่าเริ่มต้น) → เป้าตามแพ็กเกจ/ภาคเหมือนเดิม · แก้ที่ ตั้งค่า › หาตัวแทน แล้วตัวแทนเปลี่ยนตาม
--   • true               → ใช้เป้าที่กรอกเองในหน้าตัวแทน · แก้ค่าตั้งแพ็กเกจแล้ว "ไม่" ทับตัวแทนรายนี้
--   • เปลี่ยนกลับเป็น false → คิดเป้าตามแพ็กเกจให้ทันที
-- ตัวแทนเดิมทุกรายเป็น false = พฤติกรรมเดิมไม่เปลี่ยน

alter table public.dealers add column if not exists target_manual boolean not null default false;
comment on column public.dealers.target_manual is 'true = เป้ายอดขายกำหนดเองรายตัวแทน ไม่ตามแพ็กเกจ (0180)';

create or replace function public.dealers_package_target() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  t numeric;
begin
  if new.package is not null and not coalesce(new.target_manual, false) then
    t := package_annual_target(new.package, new.region);
    if t is not null then new.revenue_target := t; end if;
  end if;
  return new;
end $$;

-- สลับกลับเป็น "ตามแพ็กเกจ" ต้องคิดเป้าใหม่ด้วย
drop trigger if exists dealers_package_target on public.dealers;
create trigger dealers_package_target before insert or update of package, revenue_target, region, target_manual on public.dealers
  for each row execute function public.dealers_package_target();

create or replace function public.hq_recruit_settings_sync_targets() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.dealers d
     set revenue_target = package_annual_target(d.package, d.region)
   where d.package is not null
     and not d.target_manual
     and package_annual_target(d.package, d.region) is not null
     and d.revenue_target is distinct from package_annual_target(d.package, d.region);
  return null;
end $$;

-- ทะเบียนตัวแทน (อ่าน) — เพิ่มคอลัมน์ต่อท้าย (create or replace view เพิ่มได้เฉพาะท้ายสุด)
create or replace view public.dealers_directory as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target,
  package,
  target_manual
from public.dealers;
-- create or replace view รีเซ็ต ACL — ต้องถอน anon/PUBLIC ซ้ำทุกครั้ง (ดู 0108/0109)
revoke all on public.dealers_directory from public, anon;
grant select on public.dealers_directory to authenticated;

-- บันทึกการแก้ไขตัวแทน — รับ target_manual เพิ่ม · ไม่ส่งคีย์มา = คงค่าเดิม (ผู้เรียกเก่าไม่เปลี่ยนโหมดเป้า)
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
      package        = case when r ? 'package' then nullif(r->>'package', '') else package end,
      target_manual  = case when r ? 'target_manual' then coalesce(nullif(r->>'target_manual', '')::boolean, false) else target_manual end
    where code = r->>'code';
    get diagnostics n = row_count;
    touched := touched + n;
  end loop;

  return touched;
end $$;

revoke all    on function public.save_dealers(jsonb) from public, anon;
grant  execute on function public.save_dealers(jsonb) to   authenticated;
