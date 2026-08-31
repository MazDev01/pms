-- ── แบบแปลนของแม่แบบ (บอสสั่ง 28 ส.ค. 69) ────────────────────────────────────────
--
-- สำนักงานใหญ่แนบไฟล์แบบแปลน (PDF / รูป / DWG) ให้แม่แบบได้ · ตัวแทนเปิดดู/ดาวน์โหลดได้
--
-- ⚠️ ทำไมไม่เก็บไฟล์ลงคอลัมน์เหมือนรูปแม่แบบ:
--    รูปแม่แบบเก็บเป็น data URL (ย่อ 512px ~50KB) ซึ่งพอไหว
--    แต่แบบแปลนเป็น PDF/DWG หลัก MB — ยัดลง jsonb = ทุกครั้งที่หน้าไหนอ่านแคตตาล็อก
--    จะลากไฟล์ทั้งก้อนมาด้วย (หน้าตัวแทน/ฟอร์มลูกค้าเป้าหมาย/ใบเสนอราคา อ่านตารางนี้หมด)
--    ไฟล์จริงจึงอยู่ใน Storage bucket catalog-images (มีอยู่แล้วตั้งแต่ 0010 · HQ เขียน · อ่านสาธารณะ)
--    คอลัมน์นี้เก็บแค่ "รายการอ้างอิง" — ชื่อไฟล์ที่คนอ่านรู้เรื่อง + พาธในที่เก็บ + ขนาด
--
-- รูปแบบ plans:        [{ "name": "แปลนชั้น 1.pdf", "path": "plans/1756...-plan.pdf", "size": 220414 }]
-- รูปแบบ subtype_plans: { "โรงงานอาหาร": [ …รายการเดียวกัน… } }
--   ไม่มีคีย์ = แม่แบบย่อยนั้นไม่มีแบบแปลนเฉพาะ (หน้าจอจะใช้ของแม่แบบหลักแทน)

alter table public.master_catalog
  add column if not exists plans jsonb not null default '[]'::jsonb;
alter table public.master_catalog
  add column if not exists subtype_plans jsonb not null default '{}'::jsonb;

comment on column public.master_catalog.plans is
  'แบบแปลนของแม่แบบหลัก [{name,path,size}] — ไฟล์จริงอยู่ใน Storage bucket catalog-images';
comment on column public.master_catalog.subtype_plans is
  'แบบแปลนรายแม่แบบย่อย {ชื่อย่อย: [{name,path,size}]} — ไม่มีคีย์ = ใช้ของแม่แบบหลัก';

-- รูปร่างต้องถูกเสมอ — เหตุผลเดียวกับ 0089 ที่บังคับ subtypes/price_history เป็น array
-- ผิดรูปแล้วหน้าจอจะพังตอน .map() ซึ่งไล่หาต้นตอยากกว่าถูกปฏิเสธตั้งแต่ตอนเขียน
alter table public.master_catalog drop constraint if exists master_catalog_plans_is_array;
alter table public.master_catalog
  add constraint master_catalog_plans_is_array check (jsonb_typeof(plans) = 'array');
alter table public.master_catalog drop constraint if exists master_catalog_subtype_plans_is_object;
alter table public.master_catalog
  add constraint master_catalog_subtype_plans_is_object check (jsonb_typeof(subtype_plans) = 'object');

notify pgrst, 'reload schema';
