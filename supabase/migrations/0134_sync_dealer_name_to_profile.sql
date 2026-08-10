-- ── เปลี่ยนชื่อตัวแทนแล้ว บัญชีของสาขานั้นต้องเปลี่ยนตาม ────────────────────────────
--
-- บั๊กจริง (เอเจนต์สวมบทผู้ดูแล HQ เจอเอง 10 ส.ค. 69):
--   สำนักงานใหญ่แก้ชื่อตัวแทน → ตาราง dealers เปลี่ยน แต่ profiles ยังเป็นชื่อเดิม
--   ผลที่ผู้ใช้เจอ: ตัวแทนเปิดแอปของตัวเองแล้วยังเห็นชื่อบริษัทเก่าค้างอยู่ที่แถบข้าง
--
--   ยืนยันว่าตั้งใจให้ตรงกันจริง: ตอนสร้างตัวแทน (app/api/admin/dealers/route.ts)
--   ระบบกรอก profiles.name ด้วย "ชื่อบริษัท" ตัวเดียวกับ dealers.name
--   แปลว่าสองช่องนี้คือข้อมูลชุดเดียวกัน แค่ไม่มีอะไรทำให้มันตามกันหลังจากนั้น
--
-- ⚠️ ทำไมต้องเป็นตัวดักที่ฐานข้อมูล ไม่ใช่แก้ที่หน้าจอ:
--   การแก้ชื่อตัวแทนเกิดได้หลายทาง (หน้าทะเบียนตัวแทน · คำสั่งฝั่งเซิร์ฟเวอร์ · สคริปต์กู้คืน)
--   แก้ที่หน้าจอทางเดียวคือไล่ตามไม่ครบ แล้วปัญหาจะกลับมาแบบเงียบ ๆ ทางอื่น
--   บทเรียนเดียวกับตัวดักบันทึกแคตตาล็อก (0133) — คุมที่ชั้นข้อมูลจบทุกทาง
--
-- ⚠️ ทำไม "ไม่" ซิงก์สถานะ (active/inactive) ด้วย — ตั้งใจไม่ทำ:
--   1) ไม่จำเป็นต่อความปลอดภัย · is_account_active() (0032) ตรวจสถานะของสาขาอยู่แล้ว
--      แยกจากสถานะโปรไฟล์ ปิดสาขาแล้วบัญชีของสาขานั้นเขียนข้อมูลไม่ได้ทันที (ทดสอบล็อกอินจริงยืนยันแล้ว)
--   2) การแก้ profiles.status ถูกกันไว้ด้วย guard_profile_privilege (0026) ซึ่งยอมเฉพาะ SUPER_ADMIN
--      ถ้าให้ตัวดักนี้ไปแก้สถานะด้วย ผู้ใช้ระดับผู้บริหาร HQ จะแก้ชื่อตัวแทนไม่ได้เลย (ทั้งคำสั่งถูกยกเลิก)
--      หรือไม่ก็ต้องเจาะรูในตัวกันสิทธิ์ ซึ่งแลกไม่คุ้มกับปัญหาที่เป็นแค่ข้อมูลไม่ตรงกัน

create or replace function public.sync_dealer_name_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
     set name = new.name
   where dealer_code = new.code
     and name is distinct from new.name;
  return new;
end $$;

revoke all on function public.sync_dealer_name_to_profile() from public, anon, authenticated;

drop trigger if exists trg_sync_dealer_name on dealers;
-- when (...) = ยิงเฉพาะตอนชื่อเปลี่ยนจริง ไม่ต้องแตะ profiles ทุกครั้งที่แก้ฟิลด์อื่น
create trigger trg_sync_dealer_name
  after update on dealers
  for each row
  when (old.name is distinct from new.name)
  execute function public.sync_dealer_name_to_profile();

comment on function public.sync_dealer_name_to_profile() is
  'ชื่อสาขาใน profiles ต้องตามชื่อใน dealers เสมอ — ตัวแทนจะได้ไม่เห็นชื่อเก่าค้างในแอปตัวเอง';
