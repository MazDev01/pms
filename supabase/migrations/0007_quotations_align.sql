-- Benjamin PMS — ปรับตาราง quotations ให้ตรงกับ QuotationMock ของแอป (Phase 3)
-- 0001 ตั้ง revision เป็น integer แต่แอปใช้เป็นสตริง "V1"/"V2"/"V3" → เปลี่ยนเป็น text
-- (area เป็น text อยู่แล้ว · แอปเป็น number → แปลงด้วย mapper ฝั่งโค้ด)
-- ตารางยังไม่มีข้อมูลงานขาย (ปลอดภัย)

alter table quotations alter column revision type text using revision::text;
