-- Benjamin PMS — เปิด Realtime ให้ตารางงานขาย (Phase 7)
-- HQ/ตัวแทนเห็นการเปลี่ยนแปลงสด ๆ ข้ามเครื่อง แทน event bus ที่ผูกกับ localStorage (ข้ามแท็บได้อย่างเดียว)
-- Realtime เคารพ RLS อยู่แล้ว → ตัวแทนได้เฉพาะ event ของสาขาตัวเอง · HQ ได้ทั้งเครือ
--
-- replica identity full: ให้ event ของ UPDATE/DELETE พก record เดิมมาด้วย
-- (จำเป็นกับตารางที่เปิด RLS ไม่งั้น event ลบ/แก้ถูกกรองทิ้งเพราะไม่มีข้อมูลให้ตรวจ policy)

do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
