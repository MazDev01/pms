-- Benjamin PMS — ให้คอลัมน์ที่เพิ่ง NOT NULL (0106) มีค่าตั้งต้นของตัวเอง
--
-- ปัญหาที่เจอทันทีหลัง 0106: คอลัมน์อย่าง email/phone/category/owner/initials/color/join_date
-- ถูกบังคับ NOT NULL แต่ "ไม่มี DEFAULT" — การ INSERT ที่ไม่ระบุคอลัมน์เหล่านี้จึงพังทันที
-- ทั้งที่เจตนาของ 0106 คือ "ห้ามเป็น NULL" ไม่ใช่ "ต้องพิมพ์ครบทุกช่องทุกครั้ง"
--
-- เจอจากการรันชุดทดสอบจริง: การเตรียมข้อมูลที่เขียนลงตารางตรง ๆ (ไม่ผ่าน RPC ที่เติมค่าตั้งต้นให้)
-- ล้มด้วย "null value in column email violates not-null constraint"
-- เส้นทางของแอปเองไม่พัง เพราะส่งค่ามาครบอยู่แล้ว — แต่ข้อบังคับที่ทำให้การเขียนแบบระบุบางคอลัมน์
-- ใช้ไม่ได้เลย ถือว่าเข้มเกินความจำเป็นและจะไปสะดุดงานนำเข้าข้อมูล/สคริปต์ในอนาคต
--
-- แก้: ใส่ DEFAULT ให้ตรงกับค่าที่ RPC เติมให้อยู่แล้ว (0106) — ได้ทั้งสองอย่าง
--   • ห้ามเป็น NULL (เจตนาเดิมยังอยู่ครบ)
--   • ไม่ระบุคอลัมน์ = ได้ค่าตั้งต้น เหมือนคอลัมน์อื่นในตารางเดียวกัน
alter table customers
  alter column name      set default '',
  alter column email     set default '',
  alter column phone     set default '',
  alter column province  set default '',
  alter column category  set default '',
  alter column owner     set default '',
  alter column initials  set default '',
  alter column color     set default '',
  -- วันที่เริ่มเป็นลูกค้า: ใช้วันที่ไทยของ "ตอนที่แถวถูกสร้าง" เป็นค่าตั้งต้นที่สมเหตุสมผลที่สุด
  alter column join_date set default to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');

-- total_value / projects / status / imported / contacts มี DEFAULT อยู่แล้วตั้งแต่ 0001 — ไม่ต้องแตะ
-- quotations.total_value / material_cost ก็มี DEFAULT 0 อยู่แล้วเช่นกัน
