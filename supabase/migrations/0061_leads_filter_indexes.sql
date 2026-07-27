-- Benjamin PMS — index รองรับตัวกรองของ leads_page (ฝั่ง HQ ที่กรองข้ามสาขา)
--
-- leads_page (0049) กรองด้วย status/province/product/source นอกเหนือจาก dealer_code/created_date
--   • ฝั่งตัวแทน: กรองใน dealer_code ตัวเอง (มี idx_leads_dealer แล้ว) ชุดเล็ก ไม่ต้องมีอะไรเพิ่ม
--   • ฝั่ง HQ: กรองข้ามทั้งเครือ → status/province/product ยังไม่มี index (สแกนเมื่อ leads โต)
-- เพิ่ม btree เดี่ยว ให้ planner bitmap-AND รวมได้ตามชุดตัวกรองที่ผู้ใช้เลือก (ยืดหยุ่นกว่า composite ตายตัว)
-- หมายเหตุ: quotations listPage มี index ครบแล้ว (0040/0041 · dealer_date/status/product_line/date) ไม่ต้องเพิ่ม

create index if not exists idx_leads_status   on leads (status);
create index if not exists idx_leads_province on leads (province);
create index if not exists idx_leads_product  on leads (product);
