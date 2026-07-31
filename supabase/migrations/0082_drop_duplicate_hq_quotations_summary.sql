-- Benjamin PMS — เก็บกวาดจากผลตรวจสอบระบบเต็มรูปแบบรอบ 2 (Backend, 31 ก.ค. 69)
--
-- hq_quotations_summary มี 2 overload ค้างอยู่ในฐานข้อมูลจริง: เวอร์ชัน 7 พารามิเตอร์เดิม (0043)
-- กับเวอร์ชัน 8 พารามิเตอร์ปัจจุบัน (0044/0052 เพิ่ม p_search_dealers) — 0044 ใช้ create or replace
-- โดยไม่ drop เวอร์ชันเดิมก่อน (ต่างจาก 0048/0067 ที่ทำถูกต้อง) ทำให้ทั้งสอง overload ยังอยู่พร้อมกัน
-- ยืนยันแล้วว่าเรียกด้วย 7 พารามิเตอร์เดิมจะได้ PGRST203 (ambiguous overload) — ผู้เรียกปัจจุบันไม่โดน
-- เพราะแอปส่งครบ 8 พารามิเตอร์เสมอ แต่เป็นระเบิดเวลาสำหรับผู้เรียกในอนาคต
drop function if exists public.hq_quotations_summary(text, text[], text[], text, date, date, date);
