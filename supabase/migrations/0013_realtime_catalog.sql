-- Benjamin PMS — เปิด Realtime ให้ master_catalog (แคตตาล็อกแม่แบบ/ราคากลาง)
-- HQ แก้ที่ /hq/master → หน้า "แม่แบบ" ของตัวแทน (/products) + dropdown ราคากลาง เปลี่ยนตามทันที
-- ไม่ต้องรีโหลดหน้า · RLS ของ master_catalog = อ่านได้ทุกคน จึงส่ง event ถึงตัวแทนทุกสาขา

alter table public.master_catalog replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'master_catalog'
  ) then
    alter publication supabase_realtime add table public.master_catalog;
  end if;
end $$;
