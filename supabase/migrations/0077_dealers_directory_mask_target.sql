-- ปิดไม่ให้ตัวแทนเห็นเป้ายอดขาย (revenue_target) ของสาขาอื่น — บอสยืนยัน 30 ก.ค. 69
--   เดิม (0002_rls.sql): dealers_read = "using (true)" ให้ authenticated อ่านได้ทั้งแถวทุกสาขา
--   เจตนาคือให้เห็นทะเบียนเครือ (ชื่อ/จังหวัด/ภาค/สถานะ) แต่ revenue_target เป็นข้อมูลอ่อนไหวที่ไม่ควรข้ามสาขา
--   RLS เป็น row-level ปิดได้แค่ "ทั้งแถว" ปิดทีละคอลัมน์ไม่ได้ — ต้องมาสก์ผ่าน view แทน
--
-- security_invoker=true: view รันด้วยสิทธิ์/RLS ของผู้เรียกจริง (ไม่ใช่เจ้าของ view) — is_hq()/auth_dealer()
--   จึงอ่าน JWT ของผู้เรียกถูกต้อง และ RLS แถวของตาราง dealers เดิมยังบังคับใช้ตามปกติ
create or replace view public.dealers_directory
with (security_invoker = true) as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target
from public.dealers;

grant select on public.dealers_directory to authenticated;
