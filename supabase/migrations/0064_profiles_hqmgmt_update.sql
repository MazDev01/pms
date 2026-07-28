-- Benjamin PMS — ให้ HQ_MANAGEMENT แก้ "ข้อมูลผู้ใช้" ได้ (สอดคล้องกับสิทธิ์สร้าง/ลบผู้ใช้)
--
-- ปัญหา (สิทธิ์ไม่สม่ำเสมอ): route /api/admin/users ให้ SUPER_ADMIN + HQ_MANAGEMENT สร้าง/ลบผู้ใช้ได้
--   แต่การ "แก้" (UsersPanel → usersRepo.update ใช้ JWT ผู้เรียก) วิ่งผ่าน RLS profiles_write (0002)
--   ที่เปิดเฉพาะ SUPER_ADMIN → HQ_MANAGEMENT แก้ผู้ใช้อื่นไม่ได้ (RLS ปฏิเสธเงียบ)
--
-- แก้ (อย่างปลอดภัย): เพิ่ม policy "UPDATE" ให้ can_write_master() (= SUPER_ADMIN + HQ_MANAGEMENT ∧ active)
--   • เฉพาะ UPDATE — ไม่แตะ INSERT/DELETE (การสร้าง/ลบบัญชีจริงยังผ่าน route service_role ที่มี guard
--     กันลบ SUPER_ADMIN คนสุดท้าย ฯลฯ)
--   • role/status/dealer_code ยัง "ล็อกที่ SUPER_ADMIN" — trigger guard_profile_privilege (0026)
--     ยกเว้นเฉพาะ SUPER_ADMIN อยู่แล้ว → HQ_MANAGEMENT แก้ได้แค่ชื่อ/แผนก/เบอร์/อีเมลติดต่อ/รูป
--     เปลี่ยนบทบาท/สถานะ/สาขา ไม่ได้ (กันยกระดับสิทธิ์ตัวเอง) = ปลอดภัยเท่าเดิม

drop policy if exists profiles_mgmt_update on profiles;
create policy profiles_mgmt_update on profiles for update
  using ( can_write_master() ) with check ( can_write_master() );
