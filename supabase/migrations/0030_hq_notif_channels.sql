-- Benjamin PMS — ช่องทางแจ้งเตือนของสำนักงานใหญ่ ย้ายจาก localStorage ไป DB
--
-- hq_notif_rules (เกณฑ์ว่าเตือนเมื่อไหร่) อยู่ใน DB ตั้งแต่ 0001 แล้ว
-- แต่ hq_notifications_v2 (เปิด/ปิดช่องทาง อีเมล/ในระบบ ของแต่ละเรื่อง) ยังอยู่ในเบราว์เซอร์
-- → ผู้ดูแลคนหนึ่งตั้งไว้ อีกคนไม่เห็น · ล้างเบราว์เซอร์แล้วกลับไปค่าเริ่มต้น
--
-- เก็บรวมกับ hq_notif_rules ที่เป็นแถวเดียวอยู่แล้ว (คนละเรื่องแต่เจ้าของเดียวกัน)
-- alerts มีอยู่แล้วเป็น jsonb — เพิ่ม channels อีกก้อน
alter table hq_notif_rules add column if not exists channels jsonb not null default '{}'::jsonb;
