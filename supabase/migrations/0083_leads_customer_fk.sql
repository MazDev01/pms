-- Benjamin PMS — เก็บกวาดจากผลตรวจสอบระบบเต็มรูปแบบรอบ 2 (Database, 31 ก.ค. 69)
--
-- leads.customer_id ไม่มี FK ผูกกับ customers เลย (0035 ตั้งใจเว้นไว้ตอนนั้น เพราะการเขียน
-- customerId ให้ลีดตอนแปลงเป็นลูกค้ายัง "optimistic ไม่เรียงลำดับ" กับการสร้างลูกค้า เสี่ยง FK violate)
-- ยืนยันจริงว่าไม่มี FK ทำให้ลบลูกค้าตรงๆ (ข้าม SalesContext) เหลือลีดที่ customer_id ชี้ไปลูกค้า
-- ที่ไม่มีอยู่แล้วได้ (dangling reference)
--
-- ตอนนี้ convertLeadToCustomer (SalesContext.tsx) เรียงลำดับถูกต้องแล้ว: await
-- customersRepo.upsertForCompany() จนลูกค้าลง DB จริงก่อน แล้วค่อย finish(saved.id) ที่เขียน
-- customerId ให้ลีด (ไม่ใช่แบบ optimistic อีกต่อไป) — เหตุผลเดิมที่เว้น FK ไว้จึงหมดไปแล้ว
-- customer_id ของลีดก็เป็น sentinel สะอาดอยู่แล้ว (undefined→NULL ไม่เคยใช้ 0) ไม่ต้อง backfill
--
-- on delete restrict ให้ตรงกับ quotations_customer_fk (0035) — พฤติกรรมจริงไม่เปลี่ยน เพราะ
-- SalesContext.deleteCustomer() บล็อกการลบเมื่อยังมีลีดผูกอยู่อยู่แล้วที่ชั้นแอป (เป็นเซฟตี้เน็ต
-- ชั้นที่ 2 กันเส้นทางเขียนอื่นที่ไม่ผ่าน UI)
alter table leads drop constraint if exists leads_customer_fk;
alter table leads
  add constraint leads_customer_fk
  foreign key (dealer_code, customer_id) references customers(dealer_code, id)
  on update cascade on delete restrict;
