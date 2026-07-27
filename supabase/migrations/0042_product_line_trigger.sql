-- Benjamin PMS — แก้ product_line ให้เข้ากับ RPC create_quotation (ต่อจาก 0041)
--
-- บั๊กจาก 0041: product_line เป็น generated column · แต่ create_quotation (0034) insert ด้วย
--   `insert into quotations select * from jsonb_populate_record(null::quotations, ...)`
--   = ใส่ค่าให้ "ทุกคอลัมน์" รวม generated → Postgres ปฏิเสธ (generated column ใส่ค่าเองไม่ได้แม้ null)
--   → ออกใบเสนอราคาผ่าน RPC ล้มทั้งหมด (พิสูจน์: func-quote-win ใบไม่ลง DB)
--
-- แก้: เปลี่ยนเป็น "คอลัมน์ปกติ" ที่ trigger ดูแลค่าแทน — insert select * ใส่ค่าได้ (trigger เขียนทับ)
--   คงความทนสคีมาของ jsonb_populate_record ไว้ · ค่าเดิมไม่หาย (drop expression เก็บค่าไว้)
alter table quotations alter column product_line drop expression;

create or replace function set_quotation_product_line() returns trigger
language plpgsql as $$
begin
  new.product_line := coalesce(nullif(new.building_type, ''), new.project);
  return new;
end $$;

drop trigger if exists trg_quotation_product_line on quotations;
create trigger trg_quotation_product_line
  before insert or update on quotations
  for each row execute function set_quotation_product_line();
