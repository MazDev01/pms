-- Benjamin PMS — ปรับตาราง leads ให้ตรงกับ LeadRow ของแอป (Phase 1)
-- เหตุ: 0001 ตั้ง leads.id เป็น bigint แต่แอปสร้าง id เป็น string เอง ("#L-40322")
--       และแอปมีฟิลด์ project (ชื่อดีล) + createdAt (วันที่ไทยสำหรับแสดงผล) ที่ 0001 ยังไม่มีคอลัมน์
-- ทำบนตารางที่ยังไม่มีข้อมูลงานขาย (ปลอดภัย)
--
--   • id → text            : เก็บ id ที่แอปสร้าง (เช่น "#L-40322")
--   • project (text)        : ชื่อดีล/โครงการ
--   • created_label (text)  : สตริงวันที่ไทยจากแอป (เช่น "12 มิ.ย. 2569") ใช้ "แสดงผล"
--     — แยกจาก created_at (timestamptz) ที่ DB ประทับเวลาจริงไว้ ไม่เอามาทับกัน

alter table leads alter column id type text using id::text;
alter table leads add column if not exists project       text;
alter table leads add column if not exists created_label text;
