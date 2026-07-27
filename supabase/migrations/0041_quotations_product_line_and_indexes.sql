-- Benjamin PMS — M9 Phase 2 (foundation): เตรียม quotations ให้กรอง/เรียง/แบ่งหน้า "ที่ DB" ได้
--
-- ปัญหา: หน้า HQ กรอง product ด้วย productLine = building_type || project (derived) → กรองที่ DB ตรง ๆ ไม่ได้
-- แก้: generated column product_line (เท่ากับ mapper ฝั่งแอป: coalesce(nullif(building_type,''), project))
--      → server-side filter `product_line in (...)` ได้ตรง · index รองรับ filter/sort ตอนสเกลจริง
alter table quotations
  add column if not exists product_line text
  generated always as (coalesce(nullif(building_type, ''), project)) stored;

-- index สำหรับ Phase 2 (filter/sort/paging) — ที่สเกลใหญ่ full scan = ช้า
create index if not exists idx_quotations_dealer_date on quotations (dealer_code, date desc);
create index if not exists idx_quotations_status       on quotations (status);
create index if not exists idx_quotations_product_line  on quotations (product_line);
create index if not exists idx_quotations_date          on quotations (date desc);
