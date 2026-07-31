-- Benjamin PMS — กันราคากลางแคตตาล็อกติดลบ (จากผลตรวจสอบตรรกะระบบ 31 ก.ค. 69)
--
-- ปัญหา: หน้า /hq/master (เพิ่ม/ปรับราคา) เช็คแค่ "ห้ามว่าง/ห้ามเป็นศูนย์" (falsy check) ฝั่งเว็บ
--   ไม่เช็คค่าติดลบเลย และ master_catalog.price ไม่มี CHECK constraint ใดๆ ทั้งที่ 0069 ใส่ไว้แล้ว
--   ให้ quotations.total_value / customers.total_value — ราคานี้เป็น "ราคากลาง" ที่ถ่ายทอดสด
--   (realtime subscribeCatalog) ไปทุกสาขาทันทีที่ HQ กดบันทึก จึงต้องกันไว้ที่ DB ด้วย ไม่ใช่แค่ฝั่งเว็บ
--
-- แก้ฝั่งเว็บคู่กันแล้ว (apps/hq/app/(app)/hq/master/page.tsx: min="0" + เช็ค price > 0 แทน falsy)

alter table master_catalog add constraint master_catalog_price_nonneg check (price >= 0);
