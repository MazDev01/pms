-- Benjamin PMS — เหตุผล "ปิดการขายไม่สำเร็จ" ที่ HQ ตั้ง ต้องไปถึงตัวแทนจริง ๆ
--
-- ปัญหาเดิม: HQ ตั้งรายการเหตุผลที่ /hq/settings → เส้นทางการขาย แล้วเก็บลง localStorage
--            ของ origin ฝั่ง HQ (:3002) · ตัวแทนอ่านจาก localStorage ของ origin ตัวเอง (:3001)
--            = คนละกล่องเก็บของ ค่าที่ HQ ตั้งไม่เคยไปถึงตัวแทนเลย ทั้งโหมด local และ supabase
--            (ตัวแทนเห็นแต่รายการ fallback ที่ hardcode ไว้ ซึ่งคนละชุดกับที่ HQ เห็นด้วยซ้ำ)
--
-- แก้แบบเดียวกับ hq_policy/hq_targets: ตารางแถวเดียว (id=1) · อ่านได้ทุกคน เขียนเฉพาะ HQ
-- แล้วเปิด Realtime ให้ตัวแทนเห็นค่าใหม่ทันทีที่ HQ กดบันทึก

create table if not exists hq_sales_journey (
  id   integer primary key default 1,
  lost text[] not null default array[
    'ราคาสูงเกินงบประมาณ', 'คู่แข่งให้ข้อเสนอดีกว่า', 'งบประมาณไม่พร้อม', 'ลูกค้าไม่ตอบสนอง'
  ],
  check (id = 1)
);

insert into hq_sales_journey (id) values (1) on conflict (id) do nothing;

alter table hq_sales_journey enable row level security;
drop policy if exists hq_sales_journey_read  on hq_sales_journey;
drop policy if exists hq_sales_journey_write on hq_sales_journey;
create policy hq_sales_journey_read  on hq_sales_journey for select using ( true );
create policy hq_sales_journey_write on hq_sales_journey for all
  using ( is_hq() ) with check ( is_hq() );

-- Realtime — HQ แก้แล้วหน้าตัวแทนเปลี่ยนตามโดยไม่ต้องรีเฟรช
alter table public.hq_sales_journey replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hq_sales_journey'
  ) then
    alter publication supabase_realtime add table public.hq_sales_journey;
  end if;
end $$;
