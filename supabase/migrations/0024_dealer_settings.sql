-- Benjamin PMS — ตั้งค่าของ "ตัวแทนแต่ละสาขา" ย้ายจาก localStorage มาไว้ที่ DB
--
-- ปัญหา: หัวกระดาษใบเสนอราคา (ชื่อบริษัท/ที่อยู่/โทร/เลขภาษี/ตราประทับ/ลายเซ็น/โลโก้)
--        คำนำหน้าเลขที่ อายุใบ เงื่อนไขการชำระเงิน และการตั้งค่าแจ้งเตือน
--        เก็บอยู่ใน localStorage ของเบราว์เซอร์เครื่องที่ตัวแทนใช้
--        → ล้างเบราว์เซอร์ / เปลี่ยนเครื่อง / เปิดคนละเบราว์เซอร์ = หายหมด
--        ใบเสนอราคาที่ส่งให้ลูกค้าจะไม่มีชื่อบริษัทและไม่มีตราประทับ
--
-- เก็บเป็น jsonb ราย "กลุ่มการตั้งค่า" ไม่แตกเป็นคอลัมน์ละฟิลด์ เพราะ:
--   • เป็นค่าที่แอปอ่านทั้งก้อนเสมอ (ไม่เคย query ด้วยฟิลด์ย่อย ไม่ต้อง index)
--   • เพิ่มฟิลด์ในฟอร์มภายหลังไม่ต้อง migrate ตาราง
-- รูปสตริงยาว (โลโก้/ตราประทับ/ลายเซ็น) เป็น data URI — เก็บใน text ได้ตรง ๆ

create table if not exists dealer_settings (
  dealer_code text primary key references dealers(code) on delete cascade,
  -- หัวกระดาษ: ชื่อบริษัท/ที่อยู่/โทร/เลขประจำตัวผู้เสียภาษี
  issuer      jsonb not null default '{}'::jsonb,
  -- เอกสาร: คำนำหน้าเลขที่ · เลขรัน · อายุใบ · เงื่อนไข · ตราประทับ · ลายเซ็น
  document    jsonb not null default '{}'::jsonb,
  -- โลโก้พร้อมชื่อ (แนวนอน) สำหรับหัวเอกสาร — data URI
  wordmark    text,
  -- การแจ้งเตือนที่ตัวแทนเปิด/ปิดเอง
  notif_prefs jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table dealer_settings enable row level security;

drop policy if exists dealer_settings_select on dealer_settings;
drop policy if exists dealer_settings_write  on dealer_settings;

-- HQ อ่านได้ทั้งเครือ (ใช้ดูว่าสาขาตั้งค่าอะไรไว้) · ตัวแทนเห็นเฉพาะของตัวเอง
create policy dealer_settings_select on dealer_settings for select
  using ( is_hq() or dealer_code = auth_dealer() );

-- เขียนได้เฉพาะสาขาตัวเอง และต้องเป็นบทบาทที่มีสิทธิ์งานขาย (เหมือน 0017)
-- HQ แก้หัวกระดาษของตัวแทนไม่ได้ — เป็นข้อมูลบริษัทของสาขานั้น
create policy dealer_settings_write on dealer_settings for all
  using      ( can_write_sales() and dealer_code = auth_dealer() )
  with check ( can_write_sales() and dealer_code = auth_dealer() );

-- Realtime: ตัวแทนเปิดสองแท็บ/สองเครื่อง แก้ที่หนึ่งต้องเห็นอีกที่
alter table public.dealer_settings replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dealer_settings'
  ) then
    alter publication supabase_realtime add table public.dealer_settings;
  end if;
end $$;
