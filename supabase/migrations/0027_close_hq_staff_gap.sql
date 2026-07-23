-- Benjamin PMS — ปิดช่องที่ HQ_STAFF เขียนข้อมูลกลางได้ทั้งที่แอปห้าม
--
-- 0015 ย้ายตารางข้อมูลกลางไปใช้ can_write_master() (= SUPER_ADMIN / HQ_MANAGEMENT)
-- ให้ตรงกับ permissions.ts ที่ HQ_STAFF ไม่มี catalog:edit / dealers:manage
-- แต่มีสองที่ตกหล่น ยังใช้ is_hq() ซึ่งรวม HQ_STAFF ด้วย:
--
--   1) hq_sales_journey (สร้างทีหลังใน 0021) — รายการ "เหตุผลปิดการขายไม่สำเร็จ"
--      ที่ตัวแทนทุกสาขาต้องเลือกใช้ · HQ_STAFF แก้ได้ = เปลี่ยนตัวเลือกของทั้งเครือ
--   2) รูปแคตตาล็อกใน Storage (0010) — HQ_STAFF อัปโหลด/ทับรูปแม่แบบของทั้งเครือได้
--
-- อาการเดียวกับ C3 ที่เคยแก้ไปแล้วฝั่งงานขาย: แอปซ่อนปุ่มไว้ แต่ DB ไม่ได้ห้าม
-- ใครยิง API ตรงก็ผ่าน — การซ่อนปุ่มไม่ใช่การควบคุมสิทธิ์

drop policy if exists hq_sales_journey_write on hq_sales_journey;
create policy hq_sales_journey_write on hq_sales_journey for all
  using ( can_write_master() ) with check ( can_write_master() );

drop policy if exists catalog_images_write on storage.objects;
create policy catalog_images_write on storage.objects for all
  using      ( bucket_id = 'catalog-images' and can_write_master() )
  with check ( bucket_id = 'catalog-images' and can_write_master() );
