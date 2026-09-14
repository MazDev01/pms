-- Benjamin PMS — ค่าตั้ง "หาตัวแทน" ของสำนักงานใหญ่ (บอสสั่ง 14 ก.ย. 69)
--
-- เดิมรายการเหล่านี้เขียนตายตัวในโค้ด (ช่องทางที่เข้ามา · ช่องทางในบันทึกการติดต่อ · ชื่องานตามขั้น)
-- หรือพิมพ์เองทุกครั้ง (ประเภทธุรกิจ · เหตุผลที่ไม่สำเร็จ) → ทีมเพิ่มตัวเลือกเองไม่ได้ / พิมพ์ไม่ตรงกันจนนับไม่ได้
-- และค่าตั้งต้นของใบเสนอแพ็กเกจตัวแทน (อายุใบ · เงื่อนไขมาตรฐาน · ผู้ลงนาม · ตัวเลขตั้งต้นของแต่ละแพ็กเกจ)
--
-- เก็บเป็นแถวเดียว (id = 1) คอลัมน์ jsonb ก้อนเดียว — รูปแบบข้อมูลตรวจที่แอป (lib/recruitSettings.ts)
--   ค่าที่ขาด/เพี้ยน แอปตกไปใช้ค่าเริ่มต้นเสมอ · ค่าเริ่มต้นอยู่ในโค้ดที่เดียว (ไม่ seed ซ้ำที่ฐานข้อมูล)
--
-- สิทธิ์ชุดเดียวกับลูกค้าเป้าหมาย HQ (0170/0172): อ่าน = ฝั่งสำนักงานใหญ่ · เขียน = ผู้ดูแลข้อมูลกลาง
--   ตัวแทนจำหน่ายไม่เห็น (เป็นเรื่องงานหาตัวแทนของ HQ เอง)

create table if not exists public.hq_recruit_settings (
  id         integer primary key default 1 check (id = 1),
  config     jsonb not null default '{}'::jsonb
               check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 64000),
  updated_at timestamptz not null default now()
);

insert into public.hq_recruit_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.hq_recruit_settings_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists hq_recruit_settings_touch on public.hq_recruit_settings;
create trigger hq_recruit_settings_touch before update on public.hq_recruit_settings
  for each row execute function public.hq_recruit_settings_touch();

alter table public.hq_recruit_settings enable row level security;
revoke all on public.hq_recruit_settings from public, anon;
grant select, insert, update on public.hq_recruit_settings to authenticated;

drop policy if exists hq_recruit_settings_read on public.hq_recruit_settings;
create policy hq_recruit_settings_read on public.hq_recruit_settings
  for select using ( is_hq() );

drop policy if exists hq_recruit_settings_write on public.hq_recruit_settings;
create policy hq_recruit_settings_write on public.hq_recruit_settings
  for all using ( can_write_master() ) with check ( can_write_master() );

-- Realtime — แก้ที่หน้าตั้งค่าแล้วหน้าลูกค้าเป้าหมาย HQ ที่เปิดค้างไว้ใช้ตัวเลือกใหม่ทันที
alter table public.hq_recruit_settings replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hq_recruit_settings'
  ) then
    alter publication supabase_realtime add table public.hq_recruit_settings;
  end if;
end $$;

comment on table public.hq_recruit_settings is
  'ค่าตั้งงานหาตัวแทนของ HQ (แถวเดียว) — config: {channels, contactChannels, businessTypes, lostReasons, taskLabels, proposal}';
