-- Benjamin PMS — บังคับความสัมพันธ์ "ใบเสนอราคาต้องผูกกับลูกค้าที่มีอยู่จริง" (M6)
--
-- ปัญหา: 0018 ใส่ FK dealer_code ครบทุกตารางแล้ว แต่ "ตั้งใจเว้น" quotations.customer_id ไว้
--   เพราะแอปใช้ 0 แทน "ยังไม่มีลูกค้า" (ใบที่ออกให้ลีด) — FK รับ 0 ที่ชี้ไปลูกค้าที่ไม่มีจริงไม่ได้
--
-- แก้ครบสองด้าน:
--   • ฝั่งแอป (SupabaseAdapter): แปลง customer_id 0 ↔ NULL ที่ boundary
--       เขียน: 0 → NULL (FK ไม่ตรวจค่า NULL) · อ่าน: NULL → 0 (ตรรกะแอปยังใช้ 0 เหมือนเดิม)
--       0 ไม่เคยเป็น id ลูกค้าจริง (เลขนับเริ่มที่ 1) จึงใช้เป็น sentinel ได้ปลอดภัย
--   • ฝั่งเขียน (convertLeadToCustomer): รอ "ลูกค้าลง DB" ก่อน relink ใบ (ไม่งั้นใบถึงก่อน = FK violate)
--
-- FK แบบคู่ (dealer_code, customer_id) เพราะ customers PK เป็น (dealer_code, id) — เลขลูกค้าซ้ำข้ามสาขาได้
-- MATCH SIMPLE (ค่าเริ่มต้น): ถ้า customer_id เป็น NULL → ไม่ตรวจ FK (ใบที่ออกให้ลีดจึงผ่าน)
--   on delete restrict: ลบลูกค้าที่ยังมีใบผูกอยู่ไม่ได้ (ตอกย้ำที่แอปเช็คอยู่แล้วใน deleteCustomer)

-- เผื่อมีแถวเก่าที่ยังเป็น 0 (ตอนนี้ตารางว่าง — เป็นการป้องกันไว้)
update quotations set customer_id = null where customer_id = 0;

alter table quotations drop constraint if exists quotations_customer_fk;
alter table quotations
  add constraint quotations_customer_fk
  foreign key (dealer_code, customer_id) references customers(dealer_code, id)
  on update cascade on delete restrict;

-- หมายเหตุที่ "ยังไม่ทำ" (ตั้งใจ — เหตุผลเดียวกับ 0018):
--   • appointments.lead_id / files.record_id → ยังผูก FK ไม่ได้ (lead_id อ้าง num_id ที่ไม่ใช่ PK · record_id เป็น polymorphic) = M7
--   • leads.customer_id → ตัว sentinel สะอาดอยู่แล้ว (undefined→NULL) แต่การเขียนตอนแปลงลีด
--     ยังเป็น optimistic ไม่เรียงลำดับกับการสร้างลูกค้า จึงเว้นไว้ก่อนกัน FK violate แบบสุ่ม
