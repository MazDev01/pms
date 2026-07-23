-- Benjamin PMS — หน้า /hq/users แสดง "ผู้ใช้จริงในระบบ" แทนรายชื่อใน localStorage
--
-- เดิม hq_users_v4 อยู่ใน localStorage ของ :3002 → หน้าจัดการผู้ใช้บริหารรายชื่อที่
-- "ไม่มีผลกับการล็อกอินจริง" เลย (auth จริงอยู่ที่ Supabase Auth + profiles)
-- ลบชื่อออกจากหน้านี้แล้วคนนั้นก็ยังล็อกอินได้อยู่ดี
--
-- profiles มีเกือบครบแล้ว (name/role/status/avatar/phone) ขาดแค่แผนก
alter table profiles add column if not exists department text not null default '';
