-- Benjamin PMS — ตัดคอลัมน์ KPI ที่เป็นค่าเดโมออกจากตาราง dealers
--
-- ปัญหา: 0001 ตั้งคอลัมน์ revenue_actual / win_rate / active_projects / on_time_pct ไว้
--        แล้ว seed ใส่ตัวเลขสมมติลงไป (CNX = ฿22,438,650 · อัตราปิด 50% · ตรงเวลา 78%)
--        หน้า HQ 5 หน้าอ่านคอลัมน์พวกนี้มาแสดงเป็น "ยอดขายจริง" ทั้งที่ตารางใบเสนอราคาว่างเปล่า
--        → /hq/dashboard (คำนวณจากใบจริง) ขึ้น ฿0 แต่ /hq/dealers ขึ้น ฿22.4M ของสาขาเดียวกัน
--
-- ทำไมต้อง "ลบ" ไม่ใช่แค่ล้างค่า:
--   ค่าพวกนี้ไม่ใช่ข้อมูลที่ใครกรอก แต่เป็นผลลัพธ์ที่คำนวณได้จากใบเสนอราคา/ลีด
--   เก็บไว้ในตารางเมื่อไหร่ก็ต้องคอยซิงก์ และจะเพี้ยนจากของจริงทันทีที่ลืมซิงก์
--   ตอนนี้ทุกหน้าอ่านผ่าน useDealerPerformance() ซึ่งคำนวณสด ๆ จากข้อมูลจริงแล้ว
--
-- revenue_target ไม่ลบ — เป็นเป้าที่ HQ ตั้งเอง ไม่มีทางคำนวณจากที่ไหนได้

alter table dealers drop column if exists revenue_actual;
alter table dealers drop column if exists win_rate;
alter table dealers drop column if exists active_projects;
alter table dealers drop column if exists on_time_pct;
