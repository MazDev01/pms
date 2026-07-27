-- Benjamin PMS — แก้ FK นัดหมาย→ลีด ให้ "ลบลีดแล้วนัดยังอยู่" ได้จริง (ต่อจาก 0036)
--
-- บั๊กใน 0036: FK เป็นคู่ (dealer_code, lead_id) + on delete set null
--   set null แบบไม่ระบุคอลัมน์ = พยายามตั้ง "ทุกคอลัมน์ของ FK" เป็น null รวม dealer_code
--   แต่ appointments.dealer_code เป็น NOT NULL → ตั้ง null ไม่ได้ → การลบลีด "ล้ม/ถูกบล็อก"
--   (พิสูจน์แล้ว: ลบลีดที่มีนัดผูกอยู่ไม่สำเร็จ · นัดยังชี้ lead_id เดิม)
--
-- แก้: PG15+ ระบุคอลัมน์ที่จะ null ได้ → set null เฉพาะ lead_id (คง dealer_code ไว้)
--   ลบลีด → นัด lead_id = null (หลุดการผูก) · นัดยังอยู่พร้อม company/contact ของตัวเอง
alter table appointments drop constraint if exists appointments_lead_fk;
alter table appointments
  add constraint appointments_lead_fk
  foreign key (dealer_code, lead_id) references leads(dealer_code, num_id)
  on update cascade on delete set null (lead_id);
