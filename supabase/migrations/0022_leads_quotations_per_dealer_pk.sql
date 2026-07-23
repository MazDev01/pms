-- Benjamin PMS — ลีด/ใบเสนอราคาเป็น "เลขนับต่อสาขา" (ปิดช่องที่ 0012 ทำค้างไว้)
--
-- อาการ: สาขาที่สองสร้างลีดใบแรกไม่ได้เลย
--   แอปออกเลขลีดจาก max ของ "ลีดที่ตัวเองเห็น" ซึ่ง RLS กรองเหลือเฉพาะสาขาตัวเอง
--   ตารางว่าง → ทุกสาขาได้ #L-40322 เป็นลีดแรกเหมือนกันหมด
--   แต่ 0001/0006 ตั้ง leads.id เป็น PRIMARY KEY เดี่ยว = บังคับ unique ทั้งเครือ
--   → สาขาที่สอง insert ชน 23505 duplicate key "leads_pkey" (พิสูจน์กับ DB จริงแล้ว)
--   ใบเสนอราคาเป็นบั๊กคู่แฝด: next_quote_no() นับแยกต่อสาขาแต่ใช้ prefix เดียวกัน
--   → ทั้งสองสาขาเดินเลขมาชนกันแน่นอน (RYG อยู่ 0003 · CNX เพิ่งเริ่ม 0001)
--
-- 0012 แก้ให้ customers/appointments ไปแล้วด้วยเหตุผลเดียวกัน แต่ไม่ได้แตะสองตารางนี้
-- แก้ให้ DB ตรงกับโมเดลแอป: PK = (dealer_code, id) — เลขซ้ำข้ามสาขาได้โดยตั้งใจ
--
-- ปลอดภัย: ตรวจแล้วไม่มี FK ใดชี้มาที่ leads.id / quotations.id
--   (files.record_id, quotations.deal_id, leads.customer_id เป็นตัวเลข/ข้อความเปล่า ไม่ใช่ FK)

alter table leads      drop constraint leads_pkey;
alter table leads      add primary key (dealer_code, id);

alter table quotations drop constraint quotations_pkey;
alter table quotations add primary key (dealer_code, id);

-- adapter แก้/ลบรายแถวด้วย .eq("id", id) ล้วน (สาขาถูกจำกัดด้วย RLS อยู่แล้ว)
-- PK ใหม่ขึ้นต้นด้วย dealer_code → เงื่อนไข id ล้วนใช้ PK ไม่ได้ ต้องมี index ของตัวเอง
-- (เหตุผลเดียวกับ idx_customers_id / idx_appointments_id ใน 0020)
create index if not exists idx_leads_id      on leads      (id);
create index if not exists idx_quotations_id on quotations (id);

-- index ผสมของ 0020 ซ้ำกับ PK ใหม่แล้ว (คอลัมน์นำ + ลำดับเดียวกันเป๊ะ) — ทิ้งไป ลดภาระตอนเขียน
drop index if exists idx_leads_dealer_id;
drop index if exists idx_quotations_dealer_id;
