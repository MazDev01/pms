-- Benjamin PMS — เปิด Realtime ให้ตารางตั้งค่าระดับเครือ
-- HQ แก้ VAT / อายุใบเสนอราคา / เป้ายอดขาย ที่ /hq/settings → ฝั่งตัวแทนเปลี่ยนตามทันที
-- (ค่าพวกนี้มีผลกับ "การคิดเงิน" ของตัวแทนโดยตรง จึงต้องตรงกันทั้งเครือเสมอ)
-- RLS ของตารางเหล่านี้ = อ่านได้ทุกคน เขียนเฉพาะ HQ → ส่ง event ถึงตัวแทนได้

do $$
declare t text;
begin
  foreach t in array array['hq_policy','hq_targets','hq_notif_rules'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
