-- Benjamin PMS — ย้าย "ข้อมูลบริษัทของสำนักงานใหญ่" และ "โน้ตลูกค้า" มาไว้ที่ DB
--
-- ทั้งสองอย่างเป็นข้อมูลจริงที่ต้องอยู่ข้ามเครื่อง แต่เดิม:
--   • ข้อมูลบริษัท HQ อยู่ใน localStorage ของ :3002 → ล้างเบราว์เซอร์แล้วหาย
--     และตัวแทน (:3001) ไม่มีทางเห็น ทั้งที่เป็นชื่อบริษัทแม่ที่ควรใช้อ้างอิงได้
--   • โน้ตลูกค้าไม่มีที่เก็บเลย — มีแต่ชุดตัวอย่างใน mock.ts
--     โหมด supabase จึงปิดแท็บโน้ตไว้เฉย ๆ (ผู้ใช้จดอะไรไม่ได้)

-- ══ 1. ข้อมูลบริษัทของสำนักงานใหญ่ (แถวเดียว) ══════════════════════════
create table if not exists hq_company (
  id      integer primary key default 1,
  name    text not null default '',
  address text not null default '',
  tax_id  text not null default '',
  phone   text not null default '',
  email   text not null default '',
  website text not null default '',
  check (id = 1)
);
insert into hq_company (id) values (1) on conflict (id) do nothing;

alter table hq_company enable row level security;
drop policy if exists hq_company_read  on hq_company;
drop policy if exists hq_company_write on hq_company;
-- อ่านได้ทุกคน (ตัวแทนอ้างอิงชื่อบริษัทแม่ได้) · เขียนเฉพาะผู้มีสิทธิ์แก้ข้อมูลกลาง
create policy hq_company_read  on hq_company for select using ( true );
create policy hq_company_write on hq_company for all
  using ( can_write_master() ) with check ( can_write_master() );

-- ══ 2. โน้ตของลูกค้า/ลีด (ของแต่ละสาขา) ═══════════════════════════════
create table if not exists customer_notes (
  id          bigint generated always as identity primary key,
  dealer_code text not null references dealers(code) on delete restrict,
  -- ผูกกับลูกค้า (customers.id เป็นเลขนับต่อสาขา จึงต้องคู่กับ dealer_code เสมอ)
  customer_id integer,
  title       text not null default '',
  content     text not null default '',
  category    text not null default 'ทั่วไป',
  pinned      boolean not null default false,
  color       text not null default '#003366',
  author      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_customer_notes_dealer   on customer_notes (dealer_code, id);
create index if not exists idx_customer_notes_customer on customer_notes (dealer_code, customer_id);

alter table customer_notes enable row level security;
drop policy if exists customer_notes_select on customer_notes;
drop policy if exists customer_notes_write  on customer_notes;
-- เหมือนตารางงานขายอื่น: สาขาเห็น/แก้ของตัวเอง · HQ อ่านได้ทั้งเครือแต่เขียนไม่ได้
create policy customer_notes_select on customer_notes for select
  using ( is_hq() or dealer_code = auth_dealer() );
create policy customer_notes_write on customer_notes for all
  using      ( can_write_sales() and dealer_code = auth_dealer() )
  with check ( can_write_sales() and dealer_code = auth_dealer() );

-- Realtime — โน้ตเป็นงานร่วมกัน เปิดสองแท็บต้องเห็นตรงกัน
alter table public.customer_notes replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_notes'
  ) then
    alter publication supabase_realtime add table public.customer_notes;
  end if;
end $$;
