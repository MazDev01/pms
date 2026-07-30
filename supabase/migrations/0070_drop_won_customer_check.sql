-- Benjamin PMS — ถอด constraint quotations_won_requires_customer ที่เพิ่งใส่ใน 0069 (ด่วน)
--
-- ผิดพลาด: ตอนใส่ 0069 ยืนยันแค่ว่า flow ปกติของแอป (สร้างลูกค้าก่อน mark won ทีหลัง) ไม่ชน constraint
-- แต่ไม่ได้ตรวจว่าการเขียน 2 จุดนั้น "ไม่ atomic" กันจริง — persistQuote.update (ผูก customer_id)
-- และ persistQuote.setStatus (ตั้ง status=won) ใน SalesContext.tsx ต่างเป็น fire-and-forget
-- คนละ UPDATE statement ไม่มีการรอกันจริง (แค่เรียกเรียงกันในโค้ด ไม่ได้แปลว่าถึง DB เรียงกัน)
-- ถ้า UPDATE status='won' ไปถึง DB ก่อน UPDATE customer_id (race) — constraint ปฏิเสธการเขียนนั้น
-- ทำให้ผู้ใช้กด "ลูกค้าตอบรับ" แล้วเจอ error จริง (พิสูจน์แล้วจาก integration test func-quote-win.spec.ts
-- ที่ล้มทันทีหลัง 0069 ขึ้น prod — เดิมไม่มี error เพราะไม่มี constraint กัน ระบบ "เผลอถูก" อยู่แบบ
-- eventual-consistency ไม่ error แต่ก็ไม่ได้แปลว่าไม่มี race — race ยังอยู่ แค่ไม่มีอะไรฟ้อง)
--
-- ถอด constraint นี้ออกก่อน (หยุดความเสียหายที่ user เจอจริง) — แก้ต้นเหตุ race ที่ SalesContext.tsx
-- แยกต่างหาก (ให้การเขียน 2 จุดนี้ atomic จริงก่อน ค่อยพิจารณาใส่ constraint กลับ)
-- constraint อื่นจาก 0069 (กันมูลค่าติดลบ, NOT NULL ค่าตั้งระบบ) ไม่เกี่ยวกับ bug นี้ ยังคงไว้เหมือนเดิม

alter table quotations drop constraint if exists quotations_won_requires_customer;
