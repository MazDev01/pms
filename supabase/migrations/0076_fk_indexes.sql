-- ดัชนีที่ขาดบนคอลัมน์ปลายทาง FK — Postgres ไม่สร้างดัชนีให้ฝั่งอ้างอิงของ FK อัตโนมัติ
--   พบจากผลตรวจสอบระบบ 30 ก.ค. 69 (Low): งานทำดัชนีรอบก่อน ๆ ครอบคลุมคอลัมน์กรองที่ใช้บ่อย
--   (dealer_code/status/product/province/วันที่) แต่ตกหล่นคอลัมน์ที่เป็นปลายทาง FK พวกนี้ —
--   ไม่กระทบตอนนี้ (ตารางว่าง) แต่จะกระทบ query rollup ของ HQ และการเช็ก FK restrict/set null
--   ตอนลบแถวต้นทาง (seq scan ทั้งตารางฝั่งอ้างอิงทุกครั้ง) เมื่อข้อมูลเริ่มมีปริมาณจริง
create index if not exists idx_quotations_customer   on quotations   (dealer_code, customer_id);
create index if not exists idx_appointments_lead      on appointments (dealer_code, lead_id);
create index if not exists idx_leads_customer         on leads        (dealer_code, customer_id);
