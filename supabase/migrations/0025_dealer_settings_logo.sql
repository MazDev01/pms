-- Benjamin PMS — โลโก้สัญลักษณ์ของสาขา (ไอคอนบนแถบเมนู) ย้ายตาม 0024 มาไว้ที่ DB ด้วย
-- แยกคอลัมน์กับ wordmark เพราะเป็นคนละรูป: logo = ไอคอนสี่เหลี่ยม · wordmark = โลโก้พร้อมชื่อแนวนอน
alter table dealer_settings add column if not exists logo text;
